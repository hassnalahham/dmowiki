"use server";

import { and, eq, inArray } from "drizzle-orm";
import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
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
  pageRevisions,
  pages,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { WIKI_TAG } from "@/lib/queries";
import { deleteObject } from "@/lib/r2";
import { requireAdmin, requireStaff } from "@/lib/session";
import { titleToSlug } from "@/lib/slug";
import { summaryFromHtml } from "@/lib/wikitext/html";
import sanitizeHtml from "sanitize-html";

export type ActionState = { ok?: boolean; error?: string; message?: string } | undefined;

const fail = (e: unknown): { error: string } => ({ error: e instanceof Error ? e.message : String(e) });

function cleanHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "span", "center", "u", "s", "sup", "sub"]),
    allowedAttributes: {
      "*": ["class", "id", "style", "colspan", "rowspan", "align", "width", "height"],
      a: ["href", "target", "rel", "class", "title"],
      img: ["src", "alt", "width", "height", "loading", "class", "style", "title"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
}

async function snapshotPage(pageId: number, userId: string, comment?: string) {
  const page = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
  if (!page) return;
  const d = await db.query.digimon.findFirst({
    where: eq(digimon.pageId, pageId),
    with: { families: true, attacks: true },
  });
  const cats = await db
    .select({ name: categories.name })
    .from(pageCategories)
    .innerJoin(categories, eq(categories.id, pageCategories.categoryId))
    .where(eq(pageCategories.pageId, pageId));
  await db.insert(pageRevisions).values({
    pageId,
    userId,
    comment: comment ?? null,
    snapshot: { page, digimon: d ?? null, categories: cats.map((c) => c.name) },
  });
}

async function setCategories(pageId: number, names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  await db.delete(pageCategories).where(eq(pageCategories.pageId, pageId));
  if (!unique.length) return;
  await db
    .insert(categories)
    .values(unique.map((name) => ({ name, slug: titleToSlug(name) })))
    .onConflictDoNothing();
  const rows = await db.select({ id: categories.id }).from(categories).where(inArray(categories.name, unique));
  await db.insert(pageCategories).values(rows.map((r) => ({ pageId, categoryId: r.id }))).onConflictDoNothing();
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

const pageSchema = z.object({
  id: z.coerce.number().int().optional(),
  title: z.string().trim().min(1, "Title is required").max(250),
  slug: z.string().trim().max(250).optional(),
  type: z.string().trim().min(1).max(30),
  html: z.string().max(2_000_000).default(""),
  categories: z.string().default(""),
  published: z.coerce.boolean().default(false),
  comment: z.string().max(300).optional(),
});

export async function savePage(_: ActionState, form: FormData): Promise<ActionState> {
  const s = await requireStaff();
  const parsed = pageSchema.safeParse({
    id: form.get("id") || undefined,
    title: form.get("title"),
    slug: form.get("slug") || undefined,
    type: form.get("type") || "article",
    html: form.get("html") ?? "",
    categories: form.get("categories") ?? "",
    published: form.get("published") === "on",
    comment: form.get("comment") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const slug = titleToSlug(v.slug || v.title);
  const html = cleanHtml(v.html);
  let id = v.id;
  try {
    const clash = await db.query.pages.findFirst({ where: and(eq(pages.namespace, 0), eq(pages.slug, slug)) });
    if (clash && clash.id !== id) return { error: `Another page already uses the slug "${slug}"` };
    const values = {
      title: v.title,
      slug,
      type: v.type,
      html,
      summary: summaryFromHtml(html),
      published: v.published,
      updatedAt: new Date(),
      updatedBy: s.user.id,
    };
    if (id) {
      await db.update(pages).set(values).where(eq(pages.id, id));
    } else {
      const [row] = await db.insert(pages).values({ ...values, namespace: 0 }).returning({ id: pages.id });
      id = row.id;
    }
    await setCategories(id, v.categories.split(","));
    await snapshotPage(id, s.user.id, v.comment ?? (v.id ? "Edited" : "Created"));
  } catch (e) {
    return fail(e);
  }
  updateTag(WIKI_TAG);
  if (!v.id) redirect(`/dashboard/pages/${id}?saved=1`);
  return { ok: true, message: "Saved" };
}

export async function deletePage(id: number) {
  await requireAdmin();
  await db.delete(pages).where(eq(pages.id, id));
  updateTag(WIKI_TAG);
  redirect("/dashboard/pages");
}

export async function restoreRevision(revisionId: number) {
  const s = await requireStaff();
  const rev = await db.query.pageRevisions.findFirst({ where: eq(pageRevisions.id, revisionId) });
  if (!rev) throw new Error("Revision not found");
  const snap = rev.snapshot as {
    page: typeof pages.$inferSelect;
    digimon: (typeof digimon.$inferSelect & { families: { family: string }[]; attacks: (typeof digimonAttacks.$inferSelect)[] }) | null;
    categories: string[];
  };
  const p = snap.page;
  await db
    .update(pages)
    .set({ title: p.title, slug: p.slug, type: p.type, html: p.html, summary: p.summary, published: p.published, updatedAt: new Date(), updatedBy: s.user.id })
    .where(eq(pages.id, rev.pageId));
  await setCategories(rev.pageId, snap.categories ?? []);
  if (snap.digimon) {
    const { families, attacks, id: did, ...rest } = snap.digimon;
    await db
      .update(digimon)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(digimon.id, did));
    await db.delete(digimonFamilies).where(eq(digimonFamilies.digimonId, did));
    if (families.length) await db.insert(digimonFamilies).values(families.map((f) => ({ digimonId: did, family: f.family })));
    await db.delete(digimonAttacks).where(eq(digimonAttacks.digimonId, did));
    if (attacks.length) await db.insert(digimonAttacks).values(attacks.map((a) => ({ ...a, id: undefined, digimonId: did })));
  }
  await snapshotPage(rev.pageId, s.user.id, `Restored revision #${rev.id}`);
  updateTag(WIKI_TAG);
}

/* ------------------------------------------------------------------ */
/* Digimon                                                             */
/* ------------------------------------------------------------------ */

const attackSchema = z.object({
  name: z.string().trim().min(1),
  iconName: z.string().optional(),
  element: z.string().optional(),
  cooldown: z.string().optional(),
  dsCost: z.string().optional(),
  skillPoints: z.string().optional(),
  animation: z.string().optional(),
  baseDamage: z.string().optional(),
  upgrade: z.string().optional(),
  description: z.string().optional(),
});

const digimonSchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  stage: z.string().optional(),
  attribute: z.string().optional(),
  naturalAttribute: z.string().optional(),
  attackType: z.string().optional(),
  digimonType: z.string().optional(),
  rank: z.string().optional(),
  location: z.string().optional(),
  egg: z.string().optional(),
  rideable: z.boolean(),
  enemy: z.boolean(),
  gdmo: z.boolean(),
  kdmo: z.boolean(),
  families: z.array(z.string()),
  names: z.record(z.string(), z.string()),
  statsBase: z.record(z.string(), z.string()),
  statsMax: z.record(z.string(), z.string()),
  statsNote: z.string().optional(),
  attacks: z.array(attackSchema),
  iconMediaId: z.number().int().nullable(),
  imageMediaId: z.number().int().nullable(),
  html: z.string().max(2_000_000),
  categories: z.string(),
  published: z.boolean(),
  comment: z.string().optional(),
});

export type DigimonInput = z.infer<typeof digimonSchema>;

const blank = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function saveDigimon(input: DigimonInput): Promise<ActionState & { id?: number }> {
  const s = await requireStaff();
  const parsed = digimonSchema.safeParse(input);
  if (!parsed.success) return { error: `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` };
  const v = parsed.data;
  const slug = titleToSlug(v.name);
  const html = cleanHtml(v.html);
  try {
    let digimonId = v.id;
    let pageId: number;
    const existing = digimonId ? await db.query.digimon.findFirst({ where: eq(digimon.id, digimonId) }) : null;
    const clash = await db.query.pages.findFirst({ where: and(eq(pages.namespace, 0), eq(pages.slug, slug)) });
    if (clash && clash.id !== existing?.pageId) return { error: `A page named "${v.name}" already exists` };

    const pageValues = {
      title: v.name,
      slug,
      type: "digimon",
      html,
      summary: summaryFromHtml(html),
      published: v.published,
      updatedAt: new Date(),
      updatedBy: s.user.id,
    };
    if (existing) {
      pageId = existing.pageId;
      await db.update(pages).set(pageValues).where(eq(pages.id, pageId));
    } else {
      const [p] = await db.insert(pages).values({ ...pageValues, namespace: 0 }).returning({ id: pages.id });
      pageId = p.id;
    }

    const stats = {
      ...(Object.keys(v.statsBase).length ? { base: v.statsBase } : {}),
      ...(Object.keys(v.statsMax).length ? { max: v.statsMax } : {}),
      ...(v.statsNote ? { note: v.statsNote } : {}),
    };
    const dValues = {
      pageId,
      name: v.name,
      slug,
      names: v.names,
      stage: blank(v.stage),
      attribute: blank(v.attribute),
      naturalAttribute: blank(v.naturalAttribute),
      attackType: blank(v.attackType),
      digimonType: blank(v.digimonType),
      rank: blank(v.rank),
      location: blank(v.location),
      egg: blank(v.egg),
      rideable: v.rideable,
      enemy: v.enemy,
      gdmo: v.gdmo,
      kdmo: v.kdmo,
      stats,
      iconMediaId: v.iconMediaId,
      imageMediaId: v.imageMediaId,
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(digimon).set(dValues).where(eq(digimon.id, existing.id));
      digimonId = existing.id;
      // keep evolution steps pointing at the (possibly renamed) Digimon
      if (existing.name !== v.name) {
        await db.update(evolutionSteps).set({ digimonName: v.name }).where(eq(evolutionSteps.digimonId, existing.id));
      }
    } else {
      const [d] = await db.insert(digimon).values(dValues).returning({ id: digimon.id });
      digimonId = d.id;
      // link existing evolution steps that already mention this name
      await db
        .update(evolutionSteps)
        .set({ digimonId })
        .where(and(eq(evolutionSteps.digimonName, v.name)));
    }

    await db.delete(digimonFamilies).where(eq(digimonFamilies.digimonId, digimonId!));
    const fams = [...new Set(v.families.map((f) => f.trim()).filter(Boolean))];
    if (fams.length) await db.insert(digimonFamilies).values(fams.map((family) => ({ digimonId: digimonId!, family })));
    await db.delete(digimonAttacks).where(eq(digimonAttacks.digimonId, digimonId!));
    if (v.attacks.length)
      await db.insert(digimonAttacks).values(
        v.attacks.map((a, i) => ({
          digimonId: digimonId!,
          position: i + 1,
          name: a.name,
          iconName: blank(a.iconName),
          element: blank(a.element),
          cooldown: blank(a.cooldown),
          dsCost: blank(a.dsCost),
          skillPoints: blank(a.skillPoints),
          animation: blank(a.animation),
          baseDamage: blank(a.baseDamage),
          upgrade: blank(a.upgrade),
          description: blank(a.description),
        })),
      );

    const cats = v.categories.split(",").map((c) => c.trim());
    if (v.stage) cats.push(v.stage);
    await setCategories(pageId, cats);
    await snapshotPage(pageId, s.user.id, v.comment || (existing ? "Edited Digimon" : "Created Digimon"));
    updateTag(WIKI_TAG);
    return { ok: true, message: "Saved", id: digimonId };
  } catch (e) {
    return fail(e);
  }
}

/* ------------------------------------------------------------------ */
/* Evolution lines                                                     */
/* ------------------------------------------------------------------ */

const stepSchema = z.object({
  key: z.string(),
  digimonName: z.string().trim().min(1, "Every step needs a Digimon"),
  parentKey: z.string().nullable(),
  unlockLevel: z.number().int().nullable(),
  requiredItem: z.string().nullable(),
  kind: z.enum(["normal", "burst", "side_mega", "jogress", "armor"]),
});

const lineSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1, "Line name is required").max(200),
  note: z.string().max(1000).optional(),
  steps: z.array(stepSchema).min(1, "Add at least one step"),
});

export type LineInput = z.infer<typeof lineSchema>;

export async function saveEvolutionLine(input: LineInput): Promise<ActionState & { id?: number }> {
  await requireStaff();
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const keys = new Set(v.steps.map((s) => s.key));
  for (const s of v.steps) if (s.parentKey && !keys.has(s.parentKey)) return { error: `Unknown parent for ${s.digimonName}` };

  try {
    const names = [...new Set(v.steps.map((s) => s.digimonName.toLowerCase()))];
    const found = await db.select({ id: digimon.id, name: digimon.name }).from(digimon);
    const idByName = new Map(found.filter((d) => names.includes(d.name.toLowerCase())).map((d) => [d.name.toLowerCase(), d.id]));

    // order steps so parents come before children
    const ordered: typeof v.steps = [];
    const placed = new Set<string>();
    let guard = 0;
    while (ordered.length < v.steps.length && guard++ < 1000) {
      for (const s of v.steps) {
        if (placed.has(s.key)) continue;
        if (!s.parentKey || placed.has(s.parentKey)) {
          ordered.push(s);
          placed.add(s.key);
        }
      }
    }
    if (ordered.length !== v.steps.length) return { error: "Steps contain a cycle" };

    const id = await db.transaction(async (tx) => {
      let lineId = v.id;
      const root = ordered[0];
      const values = { name: v.name, note: v.note ?? null, rootDigimonId: idByName.get(root.digimonName.toLowerCase()) ?? null, updatedAt: new Date() };
      if (lineId) {
        await tx.update(evolutionLines).set(values).where(eq(evolutionLines.id, lineId));
        await tx.delete(evolutionSteps).where(eq(evolutionSteps.lineId, lineId));
      } else {
        const [l] = await tx.insert(evolutionLines).values(values).returning({ id: evolutionLines.id });
        lineId = l.id;
      }
      const dbIds = new Map<string, number>();
      for (const [pos, s] of ordered.entries()) {
        const [row] = await tx
          .insert(evolutionSteps)
          .values({
            lineId,
            position: pos,
            digimonName: s.digimonName,
            digimonId: idByName.get(s.digimonName.toLowerCase()) ?? null,
            parentStepId: s.parentKey ? dbIds.get(s.parentKey)! : null,
            unlockLevel: s.unlockLevel,
            requiredItem: s.requiredItem?.trim() || null,
            kind: s.kind,
          })
          .returning({ id: evolutionSteps.id });
        dbIds.set(s.key, row.id);
      }
      return lineId;
    });
    updateTag(WIKI_TAG);
    return { ok: true, message: "Saved", id };
  } catch (e) {
    const msg = String(e);
    if (msg.includes("evolution_lines_name_unique")) return { error: "A line with that name already exists" };
    return fail(e);
  }
}

export async function deleteEvolutionLine(id: number) {
  await requireStaff();
  await db.delete(evolutionLines).where(eq(evolutionLines.id, id));
  updateTag(WIKI_TAG);
  redirect("/dashboard/evolutions");
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export async function updateMediaAlt(id: number, alt: string) {
  await requireStaff();
  await db.update(media).set({ alt: alt.slice(0, 300) }).where(eq(media.id, id));
}

export async function deleteMedia(id: number): Promise<ActionState> {
  await requireAdmin();
  const m = await db.query.media.findFirst({ where: eq(media.id, id) });
  if (!m) return { error: "Not found" };
  try {
    await deleteObject(m.r2Key);
  } catch (e) {
    return fail(e);
  }
  await db.delete(media).where(eq(media.id, id));
  updateTag(WIKI_TAG);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Users (admin only, via Better Auth admin plugin)                    */
/* ------------------------------------------------------------------ */

const newUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "editor"]),
});

export async function createStaffUser(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = newUserSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await auth.api.createUser({ headers: await headers(), body: { ...parsed.data, role: parsed.data.role as "admin" } });
  } catch (e) {
    return fail(e);
  }
  return { ok: true, message: `Created ${parsed.data.email}` };
}

export async function setStaffRole(userId: string, role: "admin" | "editor") {
  const s = await requireAdmin();
  if (s.user.id === userId) throw new Error("You can't change your own role");
  await auth.api.setRole({ headers: await headers(), body: { userId, role: role as "admin" } });
}

export async function toggleBan(userId: string, banned: boolean) {
  const s = await requireAdmin();
  if (s.user.id === userId) throw new Error("You can't ban yourself");
  if (banned) await auth.api.unbanUser({ headers: await headers(), body: { userId } });
  else await auth.api.banUser({ headers: await headers(), body: { userId } });
}

export async function removeStaffUser(userId: string) {
  const s = await requireAdmin();
  if (s.user.id === userId) throw new Error("You can't delete yourself");
  await auth.api.removeUser({ headers: await headers(), body: { userId } });
}
