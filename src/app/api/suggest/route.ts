import { NextResponse, type NextRequest } from "next/server";
import { iconUrl } from "@/lib/media";
import { suggestPages } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ items: [] });
  const items = await suggestPages(q);
  return NextResponse.json(
    { items: items.map((i) => ({ ...i, icon: i.type === "digimon" ? iconUrl(i.title) : null })) },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
