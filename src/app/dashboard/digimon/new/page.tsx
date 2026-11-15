import { DigimonForm } from "@/components/dashboard/digimon-form";
import { digimonFacets } from "@/lib/queries";

export default async function NewDigimon() {
  const facets = await digimonFacets();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New Digimon</h1>
      <DigimonForm
        facets={facets}
        initial={{
          name: "",
          rideable: false,
          enemy: false,
          gdmo: false,
          kdmo: false,
          families: [],
          names: {},
          statsBase: {},
          statsMax: {},
          attacks: [],
          iconMediaId: null,
          imageMediaId: null,
          html: "",
          categories: "Digimon",
          published: true,
        }}
      />
    </div>
  );
}
