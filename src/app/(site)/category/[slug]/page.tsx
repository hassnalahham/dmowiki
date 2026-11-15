import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { iconUrl } from "@/lib/media";
import { getCategory } from "@/lib/queries";
import { slugToTitle, wikiHref } from "@/lib/slug";

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Category: ${slugToTitle(slug)}` };
}

export default function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-panel" />}>
      <Category params={params} />
    </Suspense>
  );
}

async function Category({ params }: { params: PageProps<"/category/[slug]">["params"] }) {
  const { slug } = await params;
  const cat = await getCategory(slug);
  if (!cat) notFound();
  const members = cat.members.filter((m) => m.type !== "redirect");
  const digimon = members.filter((m) => m.type === "digimon");
  const other = members.filter((m) => m.type !== "digimon");
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">Category</p>
        <h1 className="text-3xl font-bold">{cat.name}</h1>
        {cat.description && <p className="mt-2 max-w-3xl text-muted">{cat.description}</p>}
        <p className="mt-1 text-sm text-muted">{members.length} pages</p>
      </div>
      {digimon.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
          {digimon.map((d) => (
            <li key={d.slug}>
              <Link href={wikiHref(d.slug)} className="flex h-full flex-col items-center gap-1 rounded-lg border border-border bg-panel p-2 text-center no-underline hover:border-accent-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconUrl(d.title)} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 object-contain" />
                <span className="line-clamp-2 text-xs text-text">{d.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {other.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {other.map((m) => (
            <li key={m.slug}>
              <Link href={wikiHref(m.slug)} className="card block h-full p-3 no-underline hover:border-accent-2">
                <div className="font-medium text-text">{m.title}</div>
                {m.summary && <p className="mt-1 line-clamp-2 text-xs text-muted">{m.summary}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
