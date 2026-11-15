import Link from "next/link";
import { Suspense } from "react";
import { resolveMediaUrls } from "@/lib/media";
import { digimonFacets, getPage, siteCounts } from "@/lib/queries";
import { categoryHref } from "@/lib/slug";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="card relative overflow-hidden p-6 md:p-10">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <h1 className="text-3xl font-bold md:text-4xl">
          Digimon Masters Online <span className="text-accent">Wiki</span>
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Every Digimon, evolution line, item, map and quest — searchable and browsable.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/digimon" className="btn-primary no-underline">
            Browse Digimon
          </Link>
          <Link href="/categories" className="btn-ghost no-underline">
            All categories
          </Link>
        </div>
        <Suspense fallback={<div className="mt-6 h-12" />}>
          <Counts />
        </Suspense>
      </section>

      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-panel" />}>
        <Facets />
      </Suspense>

      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-panel" />}>
        <MainPage />
      </Suspense>
    </div>
  );
}

async function Counts() {
  const c = await siteCounts();
  const items = [
    ["Articles", c.pages],
    ["Digimon", c.digimon],
    ["Evolution lines", c.lines],
    ["Images", c.media],
  ] as const;
  return (
    <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg bg-bg-soft px-4 py-3">
          <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
          <dd className="text-2xl font-bold tabular-nums">{v.toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
}

async function Facets() {
  const f = await digimonFacets();
  const groups = [
    { title: "By stage", key: "stage", values: f.stages },
    { title: "By family", key: "family", values: f.families },
    { title: "By attribute", key: "attribute", values: f.attributes },
    { title: "By element", key: "element", values: f.elements },
  ];
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {groups.map((g) => (
        <div key={g.key} className="card p-4">
          <h2 className="mb-3 font-semibold text-accent">{g.title}</h2>
          <div className="flex flex-wrap gap-1.5">
            {g.values.slice(0, 30).map((v) => (
              <Link
                key={v}
                href={`/digimon?${g.key}=${encodeURIComponent(v)}`}
                className="rounded-md border border-border bg-panel-2 px-2 py-1 text-xs text-text no-underline hover:border-accent-2"
              >
                {v}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/** The imported "Main Page" article content. */
async function MainPage() {
  const page = await getPage("Main_Page");
  if (!page?.html) {
    return (
      <div className="card p-6 text-muted">
        No content yet. Run <code>npm run import</code> to load data from the source wiki, or{" "}
        <Link href={categoryHref("Digimon")}>browse categories</Link>.
      </div>
    );
  }
  return <div className="wiki-content card p-4 md:p-6" dangerouslySetInnerHTML={{ __html: resolveMediaUrls(page.html) }} />;
}
