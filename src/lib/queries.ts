import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  categories,
  digimon,
  digimonAttacks,
  digimonFamilies,
  evolutionLines,
  evolutionSteps,
  media,
  pageCategories,
  pages,
} from "@/db/schema";
import { titleToSlug } from "./slug";

/** Every public read is cached and tagged "wiki"; dashboard mutations call updateTag("wiki"). */
export const WIKI_TAG = "wiki";
function wikiCache() {
  cacheLife("days");
  cacheTag(WIKI_TAG);
}

export async function getPage(slug: string) {
  "use cache";
  wikiCache();
  const s = titleToSlug(decodeURIComponent(slug));
  const page = await db.query.pages.findFirst({
    where: and(eq(pages.namespace, 0), eq(pages.slug, s)),
  });
  if (page) return page;
  // case-insensitive fallback
  return db.query.pages.findFirst({
    where: and(eq(pages.namespace, 0), sql`lower(${pages.slug}) = lower(${s})`),
  });
}

export async function getPageCategories(pageId: number) {
  "use cache";
  wikiCache();
  return db
    .select({ name: categories.name, slug: categories.slug })
    .from(pageCategories)
    .innerJoin(categories, eq(categories.id, pageCategories.categoryId))
    .where(eq(pageCategories.pageId, pageId))
    .orderBy(asc(categories.name));
}

export async function getDigimonByPage(pageId: number) {
  "use cache";
  wikiCache();
  return db.query.digimon.findFirst({
    where: eq(digimon.pageId, pageId),
    with: {
      icon: true,
      image: true,
      families: true,
      attacks: { orderBy: [asc(digimonAttacks.position)] },
    },
  });
}

export type EvolutionStep = typeof evolutionSteps.$inferSelect & { slug: string | null };
export type EvolutionLine = typeof evolutionLines.$inferSelect & { steps: EvolutionStep[] };

/** All evolution lines that include this Digimon (deduped by shape), main line first. */
export async function getEvolutionLinesFor(name: string, digimonId?: number): Promise<EvolutionLine[]> {
  "use cache";
  wikiCache();
  const cond = digimonId
    ? or(eq(evolutionSteps.digimonId, digimonId), sql`lower(${evolutionSteps.digimonName}) = lower(${name})`)
    : sql`lower(${evolutionSteps.digimonName}) = lower(${name})`;
  const lineIds = (await db.selectDistinct({ id: evolutionSteps.lineId }).from(evolutionSteps).where(cond)).map((r) => r.id);
  if (!lineIds.length) return [];
  return loadLines(lineIds, name);
}

export async function loadLines(lineIds: number[], preferName?: string): Promise<EvolutionLine[]> {
  "use cache";
  wikiCache();
  const lines = await db.select().from(evolutionLines).where(inArray(evolutionLines.id, lineIds));
  const steps = await db
    .select({ step: evolutionSteps, slug: digimon.slug })
    .from(evolutionSteps)
    .leftJoin(digimon, eq(digimon.id, evolutionSteps.digimonId))
    .where(inArray(evolutionSteps.lineId, lineIds))
    .orderBy(asc(evolutionSteps.position));

  const byLine = new Map<number, EvolutionStep[]>();
  for (const { step, slug } of steps) {
    const arr = byLine.get(step.lineId) ?? [];
    arr.push({ ...step, slug });
    byLine.set(step.lineId, arr);
  }
  const seen = new Set<string>();
  const out: EvolutionLine[] = [];
  const pref = preferName ? `digivolve ${preferName}`.toLowerCase() : "";
  lines.sort((a, b) => {
    const pa = a.name.toLowerCase() === pref ? 0 : 1;
    const pb = b.name.toLowerCase() === pref ? 0 : 1;
    return pa - pb || a.name.localeCompare(b.name);
  });
  for (const l of lines) {
    const s = byLine.get(l.id) ?? [];
    const sig = s.map((x) => `${x.digimonName}>${s.findIndex((y) => y.id === x.parentStepId)}`).join("|");
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ ...l, steps: s });
  }
  return out;
}

export type DigimonFilters = {
  q?: string;
  stage?: string;
  attribute?: string;
  element?: string;
  family?: string;
  attackType?: string;
  rank?: string;
  kind?: "mercenary" | "enemy" | "all";
};

export async function listDigimon(f: DigimonFilters) {
  "use cache";
  wikiCache();
  const where: SQL[] = [];
  if (f.q) where.push(ilike(digimon.name, `%${f.q}%`));
  if (f.stage) where.push(eq(digimon.stage, f.stage));
  if (f.attribute) where.push(eq(digimon.attribute, f.attribute));
  if (f.element) where.push(eq(digimon.naturalAttribute, f.element));
  if (f.attackType) where.push(eq(digimon.attackType, f.attackType));
  if (f.rank) where.push(eq(digimon.rank, f.rank));
  if (f.kind === "enemy") where.push(eq(digimon.enemy, true));
  else if (f.kind !== "all") where.push(eq(digimon.enemy, false));
  if (f.family)
    where.push(
      inArray(
        digimon.id,
        db.select({ id: digimonFamilies.digimonId }).from(digimonFamilies).where(eq(digimonFamilies.family, f.family)),
      ),
    );
  return db
    .select({
      id: digimon.id,
      name: digimon.name,
      slug: digimon.slug,
      stage: digimon.stage,
      attribute: digimon.attribute,
      naturalAttribute: digimon.naturalAttribute,
      attackType: digimon.attackType,
      rank: digimon.rank,
      rideable: digimon.rideable,
      enemy: digimon.enemy,
      iconKey: media.r2Key,
    })
    .from(digimon)
    .leftJoin(media, eq(media.id, digimon.iconMediaId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(digimon.name));
}

export async function digimonFacets() {
  "use cache";
  wikiCache();
  const col = async (c: AnyPgColumn) =>
    (await db.selectDistinct({ v: c }).from(digimon).orderBy(asc(c))).map((r) => r.v as string | null).filter((v): v is string => !!v);
  const [stages, attributes, elements, attackTypes, ranks, families] = await Promise.all([
    col(digimon.stage),
    col(digimon.attribute),
    col(digimon.naturalAttribute),
    col(digimon.attackType),
    col(digimon.rank),
    db
      .selectDistinct({ v: digimonFamilies.family })
      .from(digimonFamilies)
      .orderBy(asc(digimonFamilies.family))
      .then((r) => r.map((x) => x.v)),
  ]);
  return { stages, attributes, elements, attackTypes, ranks, families };
}

export async function getCategory(slug: string) {
  "use cache";
  wikiCache();
  const s = titleToSlug(decodeURIComponent(slug));
  const cat = await db.query.categories.findFirst({ where: eq(categories.slug, s) });
  if (!cat) return null;
  const members = await db
    .select({ title: pages.title, slug: pages.slug, type: pages.type, summary: pages.summary })
    .from(pageCategories)
    .innerJoin(pages, eq(pages.id, pageCategories.pageId))
    .where(and(eq(pageCategories.categoryId, cat.id), eq(pages.published, true)))
    .orderBy(asc(pages.title));
  return { ...cat, members };
}

export async function listCategories() {
  "use cache";
  wikiCache();
  return db
    .select({ name: categories.name, slug: categories.slug, count: count(pageCategories.pageId) })
    .from(categories)
    .leftJoin(pageCategories, eq(pageCategories.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(desc(count(pageCategories.pageId)), asc(categories.name));
}

export async function listPagesByType(type: string) {
  "use cache";
  wikiCache();
  return db
    .select({ title: pages.title, slug: pages.slug, summary: pages.summary })
    .from(pages)
    .where(and(eq(pages.type, type), eq(pages.published, true)))
    .orderBy(asc(pages.title));
}

export async function searchPages(q: string, limit = 50) {
  "use cache";
  wikiCache();
  const query = q.trim();
  if (!query) return [];
  const tsv = sql`to_tsvector('english', coalesce(${pages.title}, '') || ' ' || coalesce(${pages.summary}, ''))`;
  const tsq = sql`websearch_to_tsquery('english', ${query})`;
  return db
    .select({
      title: pages.title,
      slug: pages.slug,
      type: pages.type,
      summary: pages.summary,
      rank: sql<number>`(case when lower(${pages.title}) = lower(${query}) then 10 when ${pages.title} ilike ${query + "%"} then 5 else 0 end) + ts_rank(${tsv}, ${tsq})`,
    })
    .from(pages)
    .where(
      and(
        eq(pages.namespace, 0),
        eq(pages.published, true),
        sql`${pages.type} <> 'redirect'`,
        or(ilike(pages.title, `%${query}%`), sql`${tsv} @@ ${tsq}`),
      ),
    )
    .orderBy(sql`5 desc`, asc(pages.title))
    .limit(limit);
}

/** Autocomplete: exact > prefix > word-prefix > contains, shorter titles first. Redirect aliases resolve to their target. */
export async function suggestPages(q: string, limit = 8) {
  "use cache";
  wikiCache();
  const query = q.trim().slice(0, 100);
  if (!query) return [];
  const like = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  const score = sql<number>`case
      when lower(${pages.title}) = lower(${query}) then 0
      when ${pages.title} ilike ${like + "%"} then 1
      when ${pages.title} ilike ${"% " + like + "%"} or ${pages.title} ilike ${"%(" + like + "%"} then 2
      else 3 end`;
  const rows = await db
    .select({
      title: pages.title,
      slug: pages.slug,
      type: pages.type,
      redirectTo: pages.redirectTo,
      stage: digimon.stage,
      score,
    })
    .from(pages)
    .leftJoin(digimon, eq(digimon.pageId, pages.id))
    .where(and(eq(pages.namespace, 0), eq(pages.published, true), ilike(pages.title, `%${like}%`)))
    .orderBy(sql`${score} + case when ${pages.type} = 'redirect' then 2 else 0 end`, sql`length(${pages.title})`, asc(pages.title))
    .limit(limit * 2);

  // collapse redirects onto their targets and drop duplicates
  const seen = new Set<string>();
  const out: { title: string; slug: string; type: string; stage: string | null; alias?: string }[] = [];
  for (const r of rows) {
    const isRedirect = r.type === "redirect" && r.redirectTo;
    const target = isRedirect ? titleToSlug(r.redirectTo!) : r.slug;
    if (seen.has(target.toLowerCase())) continue;
    seen.add(target.toLowerCase());
    out.push(
      isRedirect
        ? { title: r.redirectTo!.replace(/_/g, " "), slug: target, type: "page", stage: null, alias: r.title }
        : { title: r.title, slug: r.slug, type: r.type, stage: r.stage },
    );
    if (out.length >= limit) break;
  }

  // aliases that point at a Digimon should look like that Digimon (icon + stage)
  const aliasSlugs = out.filter((o) => o.alias).map((o) => o.slug);
  if (aliasSlugs.length) {
    const targets = await db
      .select({ slug: digimon.slug, name: digimon.name, stage: digimon.stage })
      .from(digimon)
      .where(inArray(digimon.slug, aliasSlugs));
    const bySlug = new Map(targets.map((t) => [t.slug.toLowerCase(), t]));
    for (const o of out) {
      const t = o.alias ? bySlug.get(o.slug.toLowerCase()) : undefined;
      if (t) Object.assign(o, { type: "digimon", stage: t.stage, title: t.name });
    }
  }
  return out;
}

export async function siteCounts() {
  "use cache";
  wikiCache();
  const [[p], [d], [l], [m]] = await Promise.all([
    db.select({ n: count() }).from(pages).where(and(eq(pages.namespace, 0), sql`${pages.type} <> 'redirect'`)),
    db.select({ n: count() }).from(digimon),
    db.select({ n: count() }).from(evolutionLines),
    db.select({ n: count() }).from(media),
  ]);
  return { pages: p.n, digimon: d.n, lines: l.n, media: m.n };
}
