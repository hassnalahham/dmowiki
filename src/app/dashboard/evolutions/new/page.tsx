import { EvolutionEditor } from "@/components/dashboard/evolution-editor";
import { digimonLookup } from "@/lib/dashboard";

export default async function NewLine() {
  const lookup = await digimonLookup();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New evolution line</h1>
      <EvolutionEditor digimonNames={lookup.names} slugs={lookup.slugs} initial={{ name: "", steps: [] }} />
    </div>
  );
}
