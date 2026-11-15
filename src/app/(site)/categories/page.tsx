import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listCategories } from "@/lib/queries";
import { categoryHref } from "@/lib/slug";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Categories</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-panel" />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const cats = (await listCategories()).filter((c) => c.count > 0);
  return (
    <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {cats.map((c) => (
        <li key={c.slug}>
          <Link href={categoryHref(c.name)} className="card flex items-center justify-between px-3 py-2 no-underline hover:border-accent-2">
            <span className="text-text">{c.name}</span>
            <span className="text-xs tabular-nums text-muted">{c.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
