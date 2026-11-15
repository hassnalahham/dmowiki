import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { pages, pageViews } from "@/db/schema";
import { titleToSlug } from "@/lib/slug";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;

function device(ua: string) {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (BOT.test(ua)) return new NextResponse(null, { status: 204 });
  let body: { path?: string; referrer?: string | null };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const path = typeof body.path === "string" ? body.path.slice(0, 500) : "";
  if (!path.startsWith("/") || path.startsWith("/dashboard") || path.startsWith("/login")) return new NextResponse(null, { status: 204 });

  let referrer: string | null = null;
  try {
    if (body.referrer) {
      const u = new URL(body.referrer);
      referrer = u.host === req.nextUrl.host ? null : u.host;
    }
  } catch {}

  let pageId: number | null = null;
  const m = path.match(/^\/wiki\/([^/?#]+)/);
  if (m) {
    const slug = titleToSlug(decodeURIComponent(m[1]));
    const p = await db.query.pages.findFirst({ columns: { id: true }, where: and(eq(pages.namespace, 0), eq(pages.slug, slug)) });
    pageId = p?.id ?? null;
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  const day = new Date().toISOString().slice(0, 10);
  const visitorHash = createHash("sha256").update(`${ip}|${ua}|${day}|${process.env.ANALYTICS_SALT ?? ""}`).digest("hex").slice(0, 32);

  await db.insert(pageViews).values({
    path,
    pageId,
    referrer,
    country: req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null,
    device: device(ua),
    visitorHash,
  });
  return new NextResponse(null, { status: 204 });
}
