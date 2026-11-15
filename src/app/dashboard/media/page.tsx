import { count, desc, ilike } from "drizzle-orm";
import { MediaGrid } from "@/components/dashboard/media-grid";
import { Pager } from "@/components/dashboard/pager";
import { db } from "@/db";
import { media } from "@/db/schema";
import { mediaUrlForKey } from "@/lib/media";
import { getSession } from "@/lib/session";

const PER = 60;

export default async function MediaAdmin({ searchParams }: PageProps<"/dashboard/media">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const cond = q ? ilike(media.filename, `%${q}%`) : undefined;
  const [rows, [{ n }], session] = await Promise.all([
    db.select().from(media).where(cond).orderBy(desc(media.createdAt), desc(media.id)).limit(PER).offset((page - 1) * PER),
    db.select({ n: count() }).from(media).where(cond),
    getSession(),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Media library</h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search file names…" className="input max-w-xs" aria-label="Search files" />
        <button className="btn-ghost">Search</button>
      </form>
      <MediaGrid
        isAdmin={session?.user.role === "admin"}
        items={rows.map((m) => ({
          id: m.id,
          filename: m.filename,
          alt: m.alt,
          url: mediaUrlForKey(m.r2Key),
          path: `/media/${m.r2Key.split("/").map(encodeURIComponent).join("/")}`,
          size: m.size,
          width: m.width,
          height: m.height,
        }))}
      />
      <Pager base="/dashboard/media" page={page} total={n} perPage={PER} params={{ q }} />
    </div>
  );
}
