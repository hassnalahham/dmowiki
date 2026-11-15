/**
 * Step 3: transform the cached wiki data and load it into Neon.
 *  - pages (+ cleaned HTML pointing at our routes and R2 media), categories
 *  - structured Digimon data (infobox, families, stats, attacks)
 *  - evolution lines/steps from every "Digivolve *" template and inline trees
 *
 * Pages / evolution lines already edited from the dashboard are left untouched unless --force.
 *
 *   npm run import:load [-- --force]
 */
import "dotenv/config"; // must run before the db module is evaluated
import fs from "node:fs";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../../src/db";
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
} from "../../src/db/schema";
import { titleToSlug } from "../../src/lib/slug";
import { parseDigimon, type ParsedDigimon } from "../../src/lib/wikitext/digimon";
import {
  isEvolutionTemplate,
  normaliseTemplateName,
  parseEvolutionLines,
  transcludedEvolutionTemplates,
  type ParsedStep,
} from "../../src/lib/wikitext/evolution";
import { summaryFromHtml, transformWikiHtml } from "../../src/lib/wikitext/html";
import { cleanSource, wikiToPlain } from "../../src/lib/wikitext/templates";
import { arg, htmlFile, nsFile, readJson, type RawPage } from "./lib";

const force = !!arg("force");

const chunk = <T,>(arr: T[], n: number) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const catName = (t: string) => t.replace(/^Category:/, "");

function pageType(p: RawPage, cats: string[], isDigimon: boolean) {
  if (isDigimon) return "digimon";
  const c = new Set(cats);
  if (c.has("Item") || c.has("Food") || c.has("Items")) return "item";
  if (c.has("Maps")) return "map";
  if ([...c].some((x) => /Quest$/.test(x))) return "quest";
  if (c.has("Patch")) return "patch";
  return "article";
}

async function main() {
  const main = readJson<RawPage[]>(nsFile(0));
  const templates = readJson<RawPage[]>(nsFile(10));
  const catPages = readJson<RawPage[]>(nsFile(14));
  const content = (p: RawPage) => p.revisions?.[0]?.slots.main.content ?? "";

  /* ---------------- categories ---------------- */
  const catDesc = new Map(catPages.map((p) => [catName(p.title), wikiToPlain(content(p)).slice(0, 1000)]));
  const allCats = new Set<string>(catDesc.keys());
  for (const p of main) for (const c of p.categories ?? []) if (!c.hidden) allCats.add(catName(c.title));
  console.log(`categories: ${allCats.size}`);
  for (const part of chunk([...allCats], 200)) {
    await db
      .insert(categories)
      .values(part.map((name) => ({ name, slug: titleToSlug(name), description: catDesc.get(name) || null })))
      .onConflictDoUpdate({ target: categories.name, set: { description: sql`excluded.description` } });
  }
  const catIds = new Map((await db.select().from(categories)).map((c) => [c.name, c.id]));

  /* ---------------- pages ---------------- */
  const edited = force
    ? new Set<string>()
    : new Set(
        (await db.select({ slug: pages.slug }).from(pages).where(and(eq(pages.namespace, 0), isNotNull(pages.updatedBy)))).map(
          (r) => r.slug,
        ),
      );

  const parsedDigimon = new Map<number, ParsedDigimon>();
  const rows: (typeof pages.$inferInsert)[] = [];
  let missingHtml = 0;

  for (const p of main) {
    const slug = titleToSlug(p.title);
    if (edited.has(slug)) continue;
    const src = content(p);
    const cats = (p.categories ?? []).filter((c) => !c.hidden).map((c) => catName(c.title));

    if (p.redirect) {
      const target = src.match(/#REDIRECT\s*\[\[([^\]|#]+)/i)?.[1]?.trim();
      rows.push({ slug, title: p.title, namespace: 0, type: "redirect", wikitext: src, redirectTo: target ?? null, sourcePageId: p.pageid, sourceRevId: p.lastrevid ?? null });
      continue;
    }

    const dg = parseDigimon(p.title, src, cats);
    if (dg) parsedDigimon.set(p.pageid, dg);

    let html = "";
    if (fs.existsSync(htmlFile(p.pageid))) {
      const raw = readJson<{ html: string }>(htmlFile(p.pageid)).html;
      const strip: string[] = [];
      if (dg) {
        strip.push("Digivolves", "Digivolutions", "Digivolution");
        if (dg.stats.base || dg.stats.max) strip.push("Default_Stats", "Stats");
        if (dg.attacks.length) strip.push("Attacks");
      }
      html = transformWikiHtml(raw, { stripInfobox: !!dg, stripSections: strip });
    } else missingHtml++;

    rows.push({
      slug,
      title: p.title,
      namespace: 0,
      type: pageType(p, cats, !!dg),
      wikitext: src,
      html,
      summary: summaryFromHtml(html) || wikiToPlain(cleanSource(src)).slice(0, 280),
      sourcePageId: p.pageid,
      sourceRevId: p.lastrevid ?? null,
      updatedAt: new Date(),
    });
  }
  if (missingHtml) console.warn(`  ${missingHtml} pages have no cached HTML (run import:fetch without --limit)`);

  console.log(`pages: upserting ${rows.length} (${edited.size} dashboard-edited pages skipped)`);
  const pageIdBySource = new Map<number, number>();
  let n = 0;
  for (const part of chunk(rows, 50)) {
    const res = await db
      .insert(pages)
      .values(part)
      .onConflictDoUpdate({
        target: [pages.namespace, pages.slug],
        set: {
          title: sql`excluded.title`,
          type: sql`excluded.type`,
          wikitext: sql`excluded.wikitext`,
          html: sql`excluded.html`,
          summary: sql`excluded.summary`,
          redirectTo: sql`excluded.redirect_to`,
          sourcePageId: sql`excluded.source_page_id`,
          sourceRevId: sql`excluded.source_rev_id`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: pages.id, sourcePageId: pages.sourcePageId });
    for (const r of res) if (r.sourcePageId) pageIdBySource.set(r.sourcePageId, r.id);
    n += part.length;
    process.stdout.write(`\r  ${n}/${rows.length}`);
  }
  process.stdout.write("\n");

  /* ---------------- page categories ---------------- */
  const pcRows: { pageId: number; categoryId: number }[] = [];
  for (const p of main) {
    const pageId = pageIdBySource.get(p.pageid);
    if (!pageId) continue;
    for (const c of p.categories ?? []) {
      const cid = catIds.get(catName(c.title));
      if (cid && !c.hidden) pcRows.push({ pageId, categoryId: cid });
    }
  }
  const touched = [...pageIdBySource.values()];
  for (const part of chunk(touched, 500)) await db.delete(pageCategories).where(inArray(pageCategories.pageId, part));
  for (const part of chunk(pcRows, 500)) await db.insert(pageCategories).values(part).onConflictDoNothing();
  console.log(`page categories: ${pcRows.length}`);

  /* ---------------- digimon ---------------- */
  const mediaIds = new Map((await db.select({ id: media.id, f: media.filename }).from(media)).map((m) => [m.f.toLowerCase(), m.id]));
  const mediaId = (file?: string) => (file ? (mediaIds.get(file.replace(/_/g, " ").toLowerCase()) ?? null) : null);

  console.log(`digimon: ${parsedDigimon.size}`);
  const digimonIdByName = new Map<string, number>();
  n = 0;
  for (const p of main) {
    const dg = parsedDigimon.get(p.pageid);
    const pageId = pageIdBySource.get(p.pageid);
    if (!dg || !pageId) continue;
    const cats = new Set((p.categories ?? []).map((c) => catName(c.title)));
    const imageFile = dg.image ? dg.image.replace(/^File:/i, "") : `${p.title}.png`;
    const values = {
      pageId,
      name: dg.name,
      slug: titleToSlug(p.title),
      names: dg.names,
      stage: dg.stage ?? null,
      attribute: dg.attribute ?? null,
      naturalAttribute: dg.naturalAttribute ?? null,
      attackType: dg.attackType ?? null,
      digimonType: dg.digimonType ?? null,
      rank: dg.rank ?? null,
      location: dg.location ?? null,
      rideable: dg.rideable || cats.has("Rideable"),
      egg: dg.egg ?? null,
      gdmo: dg.gdmo,
      kdmo: dg.kdmo,
      mercenary: cats.has("Mercenary Digimon"),
      enemy: dg.enemy,
      iconMediaId: mediaId(`${p.title} Icon.png`) ?? mediaId(`${dg.name} Icon.png`),
      imageMediaId: mediaId(imageFile) ?? mediaId(`${dg.name}.png`),
      stats: dg.stats,
      rawInfobox: dg.raw,
      updatedAt: new Date(),
    };
    const [row] = await db
      .insert(digimon)
      .values(values)
      .onConflictDoUpdate({ target: digimon.pageId, set: { ...values, pageId: undefined } })
      .returning({ id: digimon.id });
    digimonIdByName.set(p.title.toLowerCase(), row.id);
    digimonIdByName.set(dg.name.toLowerCase(), row.id);

    await db.delete(digimonFamilies).where(eq(digimonFamilies.digimonId, row.id));
    if (dg.families.length)
      await db
        .insert(digimonFamilies)
        .values([...new Set(dg.families)].map((family) => ({ digimonId: row.id, family })))
        .onConflictDoNothing();
    await db.delete(digimonAttacks).where(eq(digimonAttacks.digimonId, row.id));
    if (dg.attacks.length) await db.insert(digimonAttacks).values(dg.attacks.map((a) => ({ ...a, digimonId: row.id })));
    n++;
    if (n % 25 === 0 || n === parsedDigimon.size) process.stdout.write(`\r  ${n}/${parsedDigimon.size}`);
  }
  process.stdout.write("\n");
  // include digimon that already existed (e.g. dashboard-edited pages we skipped)
  for (const d of await db.select({ id: digimon.id, name: digimon.name, slug: digimon.slug }).from(digimon)) {
    digimonIdByName.set(d.name.toLowerCase(), d.id);
    digimonIdByName.set(d.slug.replace(/_/g, " ").toLowerCase(), d.id);
  }

  /* ---------------- evolution lines ---------------- */
  type Source = { name: string; steps: ParsedStep[] };
  const sources: Source[] = [];
  for (const t of templates) {
    const tname = t.title.replace(/^Template:/, "");
    if (!isEvolutionTemplate(normaliseTemplateName(tname))) continue;
    const lines = parseEvolutionLines(content(t));
    lines.forEach((steps, i) => sources.push({ name: i === 0 ? tname : `${tname} #${i + 1}`, steps }));
  }
  // inline trees on Digimon pages that don't use a Digivolve template
  for (const p of main) {
    if (!parsedDigimon.has(p.pageid)) continue;
    const src = content(p);
    if (transcludedEvolutionTemplates(src).length) continue;
    parseEvolutionLines(src).forEach((steps, i) => sources.push({ name: `Page: ${p.title}${i ? ` #${i + 1}` : ""}`, steps }));
  }

  const existingLines = new Set((await db.select({ name: evolutionLines.name }).from(evolutionLines)).map((r) => r.name));
  if (force && existingLines.size) {
    await db.delete(evolutionLines).where(inArray(evolutionLines.name, sources.map((s) => s.name)));
    existingLines.clear();
  }
  const newSources = sources.filter((s) => !existingLines.has(s.name));
  console.log(`evolution lines: ${sources.length} found, ${newSources.length} new`);

  const resolve = (name: string) => digimonIdByName.get(name.toLowerCase()) ?? null;
  let unresolved = 0;
  n = 0;
  for (const s of newSources) {
    await db.transaction(async (tx) => {
      const [line] = await tx
        .insert(evolutionLines)
        .values({ name: s.name, rootDigimonId: resolve(s.steps[0].name) })
        .returning({ id: evolutionLines.id });
      const ids = new Map<number, number>();
      for (const [pos, st] of s.steps.entries()) {
        const did = resolve(st.name);
        if (!did) unresolved++;
        const [row] = await tx
          .insert(evolutionSteps)
          .values({
            lineId: line.id,
            position: pos,
            digimonName: st.name,
            digimonId: did,
            parentStepId: st.parentKey === null ? null : (ids.get(st.parentKey) ?? null),
            unlockLevel: st.level,
            requiredItem: st.item,
            kind: st.kind,
          })
          .returning({ id: evolutionSteps.id });
        ids.set(st.key, row.id);
      }
    });
    n++;
    if (n % 10 === 0 || n === newSources.length) process.stdout.write(`\r  ${n}/${newSources.length}`);
  }
  process.stdout.write("\n");
  if (unresolved) console.log(`  ${unresolved} evolution steps reference Digimon without a page (kept by name)`);

  // link steps whose Digimon got a page later
  await db.execute(sql`
    update evolution_steps s set digimon_id = d.id
    from digimon d
    where s.digimon_id is null and (lower(d.name) = lower(s.digimon_name) or lower(replace(d.slug, '_', ' ')) = lower(s.digimon_name))
  `);

  console.log("load done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
