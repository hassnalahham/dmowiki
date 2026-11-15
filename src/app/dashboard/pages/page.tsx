import { and, asc, count, eq, ilike, sql, type SQL } from "drizzle-orm";
import Link from "next/link";
import { Pager } from "@/components/dashboard/pager";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { wikiHref } from "@/lib/slug";

const PER = 50;
const TYPES = ["article", "digimon", "item", "map", "quest", "patch", "redirect"];

export default async function PagesAdmin({ searchParams }: PageProps<"/dashboard/pages">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: SQL[] = [eq(pages.namespace, 0)];
  if (q) where.push(ilike(pages.title, `%${q}%`));
  if (type) where.push(eq(pages.type, type));
  else where.push(sql`${pages.type} <> 'redirect'`);

  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        id: pages.id,
        title: pages.title,
        slug: pages.slug,
        type: pages.type,
        published: pages.published,
        updatedAt: pages.updatedAt,
        edited: pages.updatedBy,
      })
      .from(pages)
      .where(and(...where))
      .orderBy(asc(pages.title))
      .limit(PER)
      .offset((page - 1) * PER),
    db.select({ n: count() }).from(pages).where(and(...where)),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Pages</h1>
        <Link href="/dashboard/pages/new" className="btn-primary no-underline">
          New page
        </Link>
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search titles…" className="input max-w-xs" aria-label="Search titles" />
        <select name="type" defaultValue={type} className="input max-w-[180px]" aria-label="Type">
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button className="btn-ghost">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-left">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-1.5">
                  <Link href={`/dashboard/pages/${r.id}`}>{r.title}</Link>
                </td>
                <td className="px-3 py-1.5 text-muted">{r.type}</td>
                <td className="px-3 py-1.5">
                  {r.published ? <span className="text-ok">Published</span> : <span className="text-muted">Draft</span>}
                  {r.edited && <span className="ml-2 rounded bg-accent/15 px-1 text-[10px] text-accent">edited</span>}
                </td>
                <td className="px-3 py-1.5 text-muted">{new Date(r.updatedAt).toLocaleDateString("en-GB")}</td>
                <td className="px-3 py-1.5 text-right">
                  <Link href={wikiHref(r.slug)} target="_blank" className="text-xs">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager base="/dashboard/pages" page={page} total={n} perPage={PER} params={{ q, type }} />
    </div>
  );
}
