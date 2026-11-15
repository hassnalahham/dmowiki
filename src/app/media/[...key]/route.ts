import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Fallback for `/media/<r2-key>` URLs stored in page HTML.
 * Redirects to the public R2 bucket; before R2 is configured, wiki images
 * fall back to the original wiki path so local development works immediately.
 */
export async function GET(_req: Request, ctx: RouteContext<"/media/[...key]">) {
  const { key } = await ctx.params;
  const parts = key.map((k) => decodeURIComponent(k));
  const r2 = process.env.R2_PUBLIC_URL;
  if (r2) {
    return NextResponse.redirect(`${r2}/${parts.map(encodeURIComponent).join("/")}`, 308);
  }
  if (parts[0] === "wiki" && parts[1]) {
    const file = parts.slice(1).join("/").replace(/ /g, "_");
    const md5 = createHash("md5").update(file).digest("hex");
    return NextResponse.redirect(`https://dmowiki.com/images/${md5[0]}/${md5.slice(0, 2)}/${encodeURIComponent(file)}`, 307);
  }
  return new NextResponse("Not found", { status: 404 });
}
