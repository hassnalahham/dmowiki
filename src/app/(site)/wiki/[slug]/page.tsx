import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { DigimonInfobox, DigimonSections } from "@/components/digimon-view";
import { resolveMediaUrls } from "@/lib/media";
import { getDigimonByPage, getEvolutionLinesFor, getPage, getPageCategories } from "@/lib/queries";
import { categoryHref, slugToTitle, wikiHref } from "@/lib/slug";

export async function generateMetadata({ params }: PageProps<"/wiki/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  return { title: page?.title ?? slugToTitle(slug), description: page?.summary ?? undefined };
}

export default function WikiPage({ params }: PageProps<"/wiki/[slug]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-panel" />}>
      <Article params={params} />
    </Suspense>
  );
}

async function Article({ params }: { params: PageProps<"/wiki/[slug]">["params"] }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page || !page.published) notFound();
  if (page.type === "redirect" && page.redirectTo) permanentRedirect(wikiHref(page.redirectTo));

  const [cats, d] = await Promise.all([
    getPageCategories(page.id),
    page.type === "digimon" ? getDigimonByPage(page.id) : null,
  ]);
  const lines = d ? await getEvolutionLinesFor(d.name, d.id) : [];
  const html = resolveMediaUrls(page.html ?? "");

  return (
    <article>
      <h1 className="mb-4 text-3xl font-bold">{page.title}</h1>
      <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          {d && <DigimonSections d={d} lines={lines} />}
          {html && <div className="wiki-content" dangerouslySetInnerHTML={{ __html: html }} />}
        </div>
        {d && <DigimonInfobox d={d} />}
      </div>
      {cats.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm">
          <span className="text-muted">Categories:</span>
          {cats.map((c) => (
            <Link key={c.slug} href={categoryHref(c.name)} className="rounded-md bg-panel px-2 py-0.5 no-underline hover:bg-panel-2">
              {c.name}
            </Link>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted">Last updated {new Date(page.updatedAt).toLocaleDateString("en-GB")}</p>
    </article>
  );
}
