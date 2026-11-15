import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DigimonForm } from "@/components/dashboard/digimon-form";
import { db } from "@/db";
import { categories, digimon, digimonAttacks, pageCategories, pages } from "@/db/schema";
import { mediaUrlForKey } from "@/lib/media";
import { digimonFacets } from "@/lib/queries";
import { wikiHref } from "@/lib/slug";

const s = (v: string | null | undefined) => v ?? "";

export default async function EditDigimon({ params }: PageProps<"/dashboard/digimon/[id]">) {
  const { id } = await params;
  const did = Number(id);
  if (!Number.isInteger(did)) notFound();
  const d = await db.query.digimon.findFirst({
    where: eq(digimon.id, did),
    with: { icon: true, image: true, families: true, attacks: { orderBy: [asc(digimonAttacks.position)] } },
  });
  if (!d) notFound();
  const [page, cats, facets] = await Promise.all([
    db.query.pages.findFirst({ where: eq(pages.id, d.pageId) }),
    db
      .select({ name: categories.name })
      .from(pageCategories)
      .innerJoin(categories, eq(categories.id, pageCategories.categoryId))
      .where(eq(pageCategories.pageId, d.pageId)),
    digimonFacets(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{d.name}</h1>
        <div className="flex gap-2">
          <Link href={`/dashboard/pages/${d.pageId}`} className="btn-ghost no-underline">
            Page &amp; revisions
          </Link>
          <Link href={wikiHref(d.slug)} target="_blank" className="btn-ghost no-underline">
            View
          </Link>
        </div>
      </div>
      <DigimonForm
        facets={facets}
        initial={{
          id: d.id,
          name: d.name,
          stage: s(d.stage),
          attribute: s(d.attribute),
          naturalAttribute: s(d.naturalAttribute),
          attackType: s(d.attackType),
          digimonType: s(d.digimonType),
          rank: s(d.rank),
          location: s(d.location),
          egg: s(d.egg),
          rideable: !!d.rideable,
          enemy: !!d.enemy,
          gdmo: !!d.gdmo,
          kdmo: !!d.kdmo,
          families: d.families.map((f) => f.family),
          names: d.names ?? {},
          statsBase: d.stats?.base ?? {},
          statsMax: d.stats?.max ?? {},
          statsNote: s(d.stats?.note),
          attacks: d.attacks.map((a) => ({
            name: a.name,
            iconName: s(a.iconName),
            element: s(a.element),
            cooldown: s(a.cooldown),
            dsCost: s(a.dsCost),
            skillPoints: s(a.skillPoints),
            animation: s(a.animation),
            baseDamage: s(a.baseDamage),
            upgrade: s(a.upgrade),
            description: s(a.description),
          })),
          iconMediaId: d.iconMediaId,
          imageMediaId: d.imageMediaId,
          iconUrl: d.icon ? mediaUrlForKey(d.icon.r2Key) : null,
          imageUrl: d.image ? mediaUrlForKey(d.image.r2Key) : null,
          html: page?.html ?? "",
          categories: cats
            .map((c) => c.name)
            .filter((c) => c !== d.stage)
            .join(", "),
          published: page?.published ?? true,
        }}
      />
    </div>
  );
}
