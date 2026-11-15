import { and, asc, count, eq, ilike, type SQL } from "drizzle-orm";
import Link from "next/link";
import { Pager } from "@/components/dashboard/pager";
import { db } from "@/db";
import { digimon, media } from "@/db/schema";
import { iconUrl, mediaUrlForKey } from "@/lib/media";
import { wikiHref } from "@/lib/slug";

const PER = 60;

export default async function DigimonAdmin({ searchParams }: PageProps<"/dashboard/digimon">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const stage = typeof sp.stage === "string" ? sp.stage : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: SQL[] = [];
  if (q) where.push(ilike(digimon.name, `%${q}%`));
  if (stage) where.push(eq(digimon.stage, stage));
  const cond = where.length ? and(...where) : undefined;

  const [rows, [{ n }], stages] = await Promise.all([
    db
      .select({ id: digimon.id, name: digimon.name, slug: digimon.slug, stage: digimon.stage, attribute: digimon.attribute, enemy: digimon.enemy, iconKey: media.r2Key })
      .from(digimon)
      .leftJoin(media, eq(media.id, digimon.iconMediaId))
      .where(cond)
      .orderBy(asc(digimon.name))
      .limit(PER)
      .offset((page - 1) * PER),
    db.select({ n: count() }).from(digimon).where(cond),
    db.selectDistinct({ s: digimon.stage }).from(digimon).orderBy(asc(digimon.stage)),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Digimon</h1>
        <Link href="/dashboard/digimon/new" className="btn-primary no-underline">
          New Digimon
        </Link>
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search Digimon…" className="input max-w-xs" aria-label="Search Digimon" />
        <select name="stage" defaultValue={stage} className="input max-w-[180px]" aria-label="Stage">
          <option value="">All stages</option>
          {stages.map((s) => s.s && <option key={s.s}>{s.s}</option>)}
        </select>
        <button className="btn-ghost">Filter</button>
      </form>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {rows.map((d) => (
          <li key={d.id} className="card flex items-center gap-3 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.iconKey ? mediaUrlForKey(d.iconKey) : iconUrl(d.name)} alt="" width={40} height={40} className="h-10 w-10 object-contain" loading="lazy" />
            <div className="min-w-0 flex-1">
              <Link href={`/dashboard/digimon/${d.id}`} className="block truncate font-medium">
                {d.name}
              </Link>
              <span className="text-xs text-muted">
                {[d.stage, d.attribute, d.enemy ? "enemy" : null].filter(Boolean).join(" · ")}
              </span>
            </div>
            <Link href={wikiHref(d.slug)} target="_blank" className="text-xs">
              View
            </Link>
          </li>
        ))}
      </ul>
      <Pager base="/dashboard/digimon" page={page} total={n} perPage={PER} params={{ q, stage }} />
    </div>
  );
}
