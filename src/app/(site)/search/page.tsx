import type { Metadata } from "next";
import Link from "next/link";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/db";
import { searchQueries } from "@/db/schema";
import { searchPages } from "@/lib/queries";
import { wikiHref } from "@/lib/slug";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Search</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-panel" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  await connection(); // search logging & results are always per-request
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 200) : "";
  if (!query) return <p className="text-muted">Type something in the search box.</p>;
  const results = await searchPages(query);

  // record the search for dashboard analytics after the response is sent
  after(async () => {
    try {
      await db.insert(searchQueries).values({ query: query.toLowerCase(), resultsCount: results.length });
    } catch {}
  });

  return (
    <>
      <p className="text-sm text-muted">
        {results.length} result{results.length === 1 ? "" : "s"} for “{query}”
      </p>
      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.slug}>
            <Link href={wikiHref(r.slug)} className="card block p-3 no-underline hover:border-accent-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text">{r.title}</span>
                <span className="rounded bg-panel-2 px-1.5 text-[10px] uppercase text-muted">{r.type}</span>
              </div>
              {r.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.summary}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
