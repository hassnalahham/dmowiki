import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { media } from "@/db/schema";
import { auth } from "@/lib/auth";
import { mediaUrlForKey } from "@/lib/media";
import { presignPut } from "@/lib/r2";

const ALLOWED = /^(image\/(png|jpe?g|gif|webp|svg\+xml|avif))$/;

const presignSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().regex(ALLOWED, "Only images are allowed"),
  size: z.number().int().positive().max(20 * 1024 * 1024),
  /** overwrite an existing media file in place (keeps its URL) */
  replaceId: z.number().int().positive().optional(),
});

const confirmSchema = z.object({
  key: z.string().min(1),
  filename: z.string().min(1).max(200),
  contentType: z.string().regex(ALLOWED),
  size: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().max(300).optional(),
});

async function staff(req: NextRequest) {
  const s = await auth.api.getSession({ headers: req.headers });
  return s && !s.user.banned ? s : null;
}

/** Step 1: get a presigned PUT URL for direct browser -> R2 upload. */
export async function POST(req: NextRequest) {
  const s = await staff(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = presignSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  if (parsed.data.replaceId) {
    const existing = await db.query.media.findFirst({ where: eq(media.id, parsed.data.replaceId) });
    if (!existing) return NextResponse.json({ error: "Media not found" }, { status: 404 });
    const url = await presignPut(existing.r2Key, parsed.data.contentType);
    return NextResponse.json({ url, key: existing.r2Key, replaceId: existing.id });
  }
  const safe = parsed.data.filename.replace(/[^\w.\- ()]+/g, "_").replace(/ /g, "_");
  const key = `uploads/${Date.now().toString(36)}-${safe}`;
  const url = await presignPut(key, parsed.data.contentType);
  return NextResponse.json({ url, key });
}

/** Step 2: after the browser PUT succeeds, register the file in the media library. */
export async function PUT(req: NextRequest) {
  const s = await staff(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = confirmSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;
  const existing = await db.query.media.findFirst({ where: eq(media.r2Key, d.key) });
  if (existing) {
    const [row] = await db
      .update(media)
      .set({ mime: d.contentType, size: d.size, width: d.width ?? existing.width, height: d.height ?? existing.height })
      .where(eq(media.id, existing.id))
      .returning();
    return NextResponse.json({ media: row, url: mediaUrlForKey(row.r2Key) });
  }
  if (!d.key.startsWith("uploads/")) return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  // filename must be unique (wiki-style names like "Agumon Icon.png" are referenced by name)
  let filename = d.filename.replace(/_/g, " ");
  const [row] = await db
    .insert(media)
    .values({ filename, r2Key: d.key, mime: d.contentType, size: d.size, width: d.width, height: d.height, alt: d.alt, uploadedBy: s.user.id })
    .onConflictDoNothing()
    .returning();
  if (!row) {
    filename = `${Date.now().toString(36)} ${filename}`;
    const [r2] = await db
      .insert(media)
      .values({ filename, r2Key: d.key, mime: d.contentType, size: d.size, width: d.width, height: d.height, alt: d.alt, uploadedBy: s.user.id })
      .returning();
    return NextResponse.json({ media: r2, url: mediaUrlForKey(r2.r2Key) });
  }
  return NextResponse.json({ media: row, url: mediaUrlForKey(row.r2Key) });
}
