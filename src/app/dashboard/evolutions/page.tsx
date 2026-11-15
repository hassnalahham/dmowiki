import { asc, count, ilike, inArray, or } from "drizzle-orm";
import Link from "next/link";
import { Pager } from "@/components/dashboard/pager";
import { db } from "@/db";
import { evolutionLines, evolutionSteps } from "@/db/schema";

const PER = 50;

export default async function EvolutionsAdmin({ searchParams }: PageProps<"/dashboard/evolutions">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const cond = q
    ? or(
        ilike(evolutionLines.name, `%${q}%`),
        inArray(evolutionLines.id, db.select({ id: evolutionSteps.lineId }).from(evolutionSteps).where(ilike(evolutionSteps.digimonName, `%${q}%`))),
      )
    : undefined;

  const [lines, [{ n }]] = await Promise.all([
    db.select().from(evolutionLines).where(cond).orderBy(asc(evolutionLines.name)).limit(PER).offset((page - 1) * PER),
    db.select({ n: count() }).from(evolutionLines).where(cond),
  ]);
  const steps = lines.length
    ? await db
        .select({ lineId: evolutionSteps.lineId, name: evolutionSteps.digimonName, linked: evolutionSteps.digimonId })
        .from(evolutionSteps)
        .where(inArray(evolutionSteps.lineId, lines.map((l) => l.id)))
        .orderBy(asc(evolutionSteps.position))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Evolution lines</h1>
        <Link href="/dashboard/evolutions/new" className="btn-primary no-underline">
          New line
        </Link>
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Line or Digimon name…" className="input max-w-xs" aria-label="Search lines" />
        <button className="btn-ghost">Search</button>
      </form>
      <ul className="space-y-2">
        {lines.map((l) => {
          const s = steps.filter((x) => x.lineId === l.id);
          const unlinked = s.filter((x) => !x.linked).length;
          return (
            <li key={l.id} className="card p-3">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/dashboard/evolutions/${l.id}`} className="font-medium">
                  {l.name}
                </Link>
                {unlinked > 0 && <span className="text-xs text-accent">{unlinked} without page</span>}
              </div>
              <p className="mt-1 truncate text-xs text-muted">{s.map((x) => x.name).join(" → ")}</p>
            </li>
          );
        })}
      </ul>
      <Pager base="/dashboard/evolutions" page={page} total={n} perPage={PER} params={{ q }} />
    </div>
  );
}
