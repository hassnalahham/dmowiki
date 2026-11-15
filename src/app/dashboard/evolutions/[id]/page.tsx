import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { EvolutionEditor } from "@/components/dashboard/evolution-editor";
import { db } from "@/db";
import { evolutionLines, evolutionSteps } from "@/db/schema";
import { digimonLookup } from "@/lib/dashboard";

export default async function EditLine({ params }: PageProps<"/dashboard/evolutions/[id]">) {
  const { id } = await params;
  const lineId = Number(id);
  if (!Number.isInteger(lineId)) notFound();
  const line = await db.query.evolutionLines.findFirst({ where: eq(evolutionLines.id, lineId) });
  if (!line) notFound();
  const [steps, lookup] = await Promise.all([
    db.select().from(evolutionSteps).where(eq(evolutionSteps.lineId, lineId)).orderBy(asc(evolutionSteps.position)),
    digimonLookup(),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit evolution line</h1>
      <EvolutionEditor
        digimonNames={lookup.names}
        slugs={lookup.slugs}
        initial={{
          id: line.id,
          name: line.name,
          note: line.note ?? "",
          steps: steps.map((s) => ({
            key: String(s.id),
            digimonName: s.digimonName,
            parentKey: s.parentStepId ? String(s.parentStepId) : null,
            unlockLevel: s.unlockLevel,
            requiredItem: s.requiredItem,
            kind: s.kind as "normal",
          })),
        }}
      />
    </div>
  );
}
