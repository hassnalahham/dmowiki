import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { listPagesByType } from "@/lib/queries";
import { wikiHref } from "@/lib/slug";

const TYPES: Record<string, string> = {
  item: "Items",
  map: "Maps",
  quest: "Quests",
  patch: "Patches",
  article: "Articles",
};

export async function generateMetadata({ params }: PageProps<"/browse/[type]">): Promise<Metadata> {
  const { type } = await params;
  return { title: TYPES[type] ?? "Browse" };
}

export default function BrowsePage({ params }: PageProps<"/browse/[type]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-panel" />}>
      <Browse params={params} />
    </Suspense>
  );
}

async function Browse({ params }: { params: PageProps<"/browse/[type]">["params"] }) {
  const { type } = await params;
  if (!TYPES[type]) notFound();
  const list = await listPagesByType(type);
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">{TYPES[type]}</h1>
      <p className="text-sm text-muted">{list.length} pages</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <li key={p.slug}>
            <Link href={wikiHref(p.slug)} className="card block h-full p-3 no-underline hover:border-accent-2">
              <div className="font-medium text-text">{p.title}</div>
              {p.summary && <p className="mt-1 line-clamp-2 text-xs text-muted">{p.summary}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
