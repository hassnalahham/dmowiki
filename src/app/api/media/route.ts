import { desc, ilike } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { media } from "@/db/schema";
import { auth } from "@/lib/auth";
import { mediaUrlForKey } from "@/lib/media";

/** Staff-only media search used by the picker. */
export async function GET(req: NextRequest) {
  const s = await auth.api.getSession({ headers: req.headers });
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const rows = await db
    .select()
    .from(media)
    .where(q ? ilike(media.filename, `%${q}%`) : undefined)
    .orderBy(desc(media.createdAt))
    .limit(60);
  return NextResponse.json({
    items: rows.map((m) => ({ id: m.id, filename: m.filename, alt: m.alt, url: mediaUrlForKey(m.r2Key), path: `/media/${m.r2Key.split("/").map(encodeURIComponent).join("/")}` })),
  });
}
