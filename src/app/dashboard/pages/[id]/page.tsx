import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageForm } from "@/components/dashboard/page-form";
import { RevisionList } from "@/components/dashboard/revision-list";
import { db } from "@/db";
import { categories, digimon, pageCategories, pageRevisions, pages, user } from "@/db/schema";
import { getSession } from "@/lib/session";
import { wikiHref } from "@/lib/slug";
import { DeletePageButton } from "./delete-button";

export default async function EditPage({ params }: PageProps<"/dashboard/pages/[id]">) {
  const { id } = await params;
  const pageId = Number(id);
  if (!Number.isInteger(pageId)) notFound();
  const page = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
  if (!page) notFound();
  const [cats, revs, dg, session] = await Promise.all([
    db
      .select({ name: categories.name })
      .from(pageCategories)
      .innerJoin(categories, eq(categories.id, pageCategories.categoryId))
      .where(eq(pageCategories.pageId, pageId)),
    db
      .select({ id: pageRevisions.id, comment: pageRevisions.comment, user: user.name, createdAt: pageRevisions.createdAt })
      .from(pageRevisions)
      .leftJoin(user, eq(user.id, pageRevisions.userId))
      .where(eq(pageRevisions.pageId, pageId))
      .orderBy(desc(pageRevisions.createdAt))
      .limit(30),
    db.query.digimon.findFirst({ columns: { id: true }, where: eq(digimon.pageId, pageId) }),
    getSession(),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Edit: {page.title}</h1>
          <div className="flex gap-2">
            {dg && (
              <Link href={`/dashboard/digimon/${dg.id}`} className="btn-ghost no-underline">
                Edit Digimon data
              </Link>
            )}
            <Link href={wikiHref(page.slug)} target="_blank" className="btn-ghost no-underline">
              View
            </Link>
          </div>
        </div>
        <PageForm
          initial={{
            id: page.id,
            title: page.title,
            slug: page.slug,
            type: page.type,
            html: page.html ?? "",
            categories: cats.map((c) => c.name).join(", "),
            published: page.published,
          }}
        />
      </div>
      <aside className="space-y-4">
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Revisions</h2>
          <RevisionList revisions={revs} />
        </section>
        {session?.user.role === "admin" && (
          <section className="card border-danger/40 p-4">
            <h2 className="mb-2 font-semibold">Danger zone</h2>
            <DeletePageButton id={page.id} />
          </section>
        )}
      </aside>
    </div>
  );
}
