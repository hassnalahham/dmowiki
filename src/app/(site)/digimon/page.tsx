import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { iconUrl, mediaUrlForKey } from "@/lib/media";
import { digimonFacets, listDigimon, type DigimonFilters } from "@/lib/queries";
import { wikiHref } from "@/lib/slug";
import { attackTypeLabel } from "@/lib/wikitext/digimon";

export const metadata: Metadata = { title: "Digimon" };

const FILTERS = [
  ["stage", "Stage", "stages"],
  ["attribute", "Attribute", "attributes"],
  ["element", "Element", "elements"],
  ["family", "Family", "families"],
  ["attackType", "Attacker", "attackTypes"],
  ["rank", "Rank", "ranks"],
] as const;

export default function DigimonIndex({ searchParams }: PageProps<"/digimon">) {
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Digimon</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-panel" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/digimon">["searchParams"] }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const filters: DigimonFilters = {
    q: one("q"),
    stage: one("stage"),
    attribute: one("attribute"),
    element: one("element"),
    family: one("family"),
    attackType: one("attackType"),
    rank: one("rank"),
    kind: (one("kind") as DigimonFilters["kind"]) ?? undefined,
  };
  const [facets, list] = await Promise.all([digimonFacets(), listDigimon(filters)]);
  const view = one("view") === "table" ? "table" : "grid";

  return (
    <>
      <form className="card grid grid-cols-2 gap-3 p-4 lg:grid-cols-4" action="/digimon">
        <div className="col-span-2">
          <label className="label" htmlFor="q">
            Name
          </label>
          <input id="q" name="q" defaultValue={filters.q} placeholder="e.g. Agumon" className="input" />
        </div>
        {FILTERS.map(([key, label, facet]) => (
          <div key={key}>
            <label className="label" htmlFor={key}>
              {label}
            </label>
            <select id={key} name={key} defaultValue={filters[key] ?? ""} className="input">
              <option value="">Any</option>
              {facets[facet].map((v) => (
                <option key={v} value={v}>
                  {key === "attackType" ? attackTypeLabel(v) : v}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div>
          <label className="label" htmlFor="kind">
            Show
          </label>
          <select id="kind" name="kind" defaultValue={filters.kind ?? ""} className="input">
            <option value="">Playable</option>
            <option value="enemy">Enemies / Raids</option>
            <option value="all">All</option>
          </select>
        </div>
        <input type="hidden" name="view" value={view} />
        <div className="col-span-2 flex items-end gap-2 lg:col-span-1">
          <button className="btn-primary">Filter</button>
          <Link href="/digimon" className="btn-ghost no-underline">
            Reset
          </Link>
        </div>
      </form>

      <div className="flex items-center justify-between text-sm text-muted">
        <span>{list.length} Digimon</span>
        <div className="flex gap-1">
          {(["grid", "table"] as const).map((v) => {
            const q = new URLSearchParams(Object.entries(sp).filter(([, x]) => typeof x === "string") as [string, string][]);
            q.set("view", v);
            return (
              <Link key={v} href={`/digimon?${q}`} className={`rounded-md px-2 py-1 no-underline ${view === v ? "bg-panel-2 text-text" : "text-muted"}`}>
                {v === "grid" ? "Grid" : "Table"}
              </Link>
            );
          })}
        </div>
      </div>

      {view === "grid" ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
          {list.map((d) => (
            <li key={d.id}>
              <Link
                href={wikiHref(d.slug)}
                className="flex h-full flex-col items-center gap-1 rounded-lg border border-border bg-panel p-2 text-center no-underline hover:border-accent-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.iconKey ? mediaUrlForKey(d.iconKey) : iconUrl(d.name)} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 object-contain" />
                <span className="line-clamp-2 text-xs text-text">{d.name}</span>
                <span className="text-[10px] text-muted">{d.stage}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-left">
              <tr>
                {["Digimon", "Stage", "Attribute", "Element", "Attacker", "Rank", "Ride"].map((h) => (
                  <th key={h} className="px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    <Link href={wikiHref(d.slug)} className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.iconKey ? mediaUrlForKey(d.iconKey) : iconUrl(d.name)} alt="" width={28} height={28} loading="lazy" className="h-7 w-7" />
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5">{d.stage}</td>
                  <td className="px-3 py-1.5">{d.attribute}</td>
                  <td className="px-3 py-1.5">{d.naturalAttribute}</td>
                  <td className="px-3 py-1.5">{attackTypeLabel(d.attackType)}</td>
                  <td className="px-3 py-1.5">{d.rank}</td>
                  <td className="px-3 py-1.5">{d.rideable ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
