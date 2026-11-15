"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteEvolutionLine, saveEvolutionLine, type LineInput } from "@/app/dashboard/actions";
import { EvolutionTree, type TreeStep } from "@/components/evolution-tree";

type Step = LineInput["steps"][number];
const KINDS: Step["kind"][] = ["normal", "burst", "side_mega", "jogress", "armor"];

let counter = 0;
const newKey = () => `n${Date.now().toString(36)}${counter++}`;

export function EvolutionEditor({
  initial,
  digimonNames,
  slugs,
}: {
  initial: { id?: number; name: string; note?: string; steps: Step[] };
  digimonNames: string[];
  slugs: Record<string, string>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [note, setNote] = useState(initial.note ?? "");
  const [steps, setSteps] = useState<Step[]>(initial.steps.length ? initial.steps : [{ key: newKey(), digimonName: "", parentKey: null, unlockLevel: null, requiredItem: null, kind: "normal" }]);
  const [status, setStatus] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<Step>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const descendants = (key: string): Set<string> => {
    const out = new Set<string>([key]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of steps) {
        if (s.parentKey && out.has(s.parentKey) && !out.has(s.key)) {
          out.add(s.key);
          grew = true;
        }
      }
    }
    return out;
  };

  const preview: TreeStep[] = useMemo(() => {
    const idx = new Map(steps.map((s, i) => [s.key, i + 1]));
    return steps
      .filter((s) => s.digimonName.trim())
      .map((s, i) => ({
        id: idx.get(s.key) ?? i + 1,
        digimonName: s.digimonName.trim(),
        slug: slugs[s.digimonName.trim().toLowerCase()] ?? null,
        parentStepId: s.parentKey ? (idx.get(s.parentKey) ?? null) : null,
        unlockLevel: s.unlockLevel,
        requiredItem: s.requiredItem,
        kind: s.kind,
      }));
  }, [steps, slugs]);

  const save = () => {
    setStatus({});
    start(async () => {
      const res = await saveEvolutionLine({ id: initial.id, name, note, steps });
      if (res?.error) return setStatus({ error: res.error });
      setStatus({ ok: "Saved" });
      if (!initial.id && res?.id) router.replace(`/dashboard/evolutions/${res.id}`);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="card grid gap-4 p-4 md:grid-cols-2">
        <label className="block">
          <span className="label">Line name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Digivolve Agumon" className="input" />
        </label>
        <label className="block">
          <span className="label">Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input" />
        </label>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Preview</h2>
        {preview.length ? <EvolutionTree steps={preview} /> : <p className="text-sm text-muted">Add steps to see the tree.</p>}
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Steps</h2>
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              setSteps((s) => [
                ...s,
                { key: newKey(), digimonName: "", parentKey: s.at(-1)?.key ?? null, unlockLevel: null, requiredItem: null, kind: "normal" },
              ])
            }
          >
            <Plus className="h-4 w-4" /> Add step
          </button>
        </div>
        <datalist id="digimon-names">
          {digimonNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="p-1">#</th>
                <th className="p-1">Digimon</th>
                <th className="p-1">Evolves from</th>
                <th className="p-1">Unlock Lv.</th>
                <th className="p-1">Required item</th>
                <th className="p-1">Kind</th>
                <th className="p-1" />
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => {
                const blocked = descendants(s.key);
                const known = !s.digimonName || slugs[s.digimonName.trim().toLowerCase()];
                return (
                  <tr key={s.key} className="border-t border-border">
                    <td className="p-1 text-muted">{i + 1}</td>
                    <td className="p-1">
                      <input
                        list="digimon-names"
                        value={s.digimonName}
                        onChange={(e) => update(i, { digimonName: e.target.value })}
                        className={`input ${known ? "" : "border-accent/60"}`}
                        aria-label={`Step ${i + 1} Digimon`}
                        title={known ? undefined : "No Digimon page with this name yet — it will be shown without a link"}
                      />
                    </td>
                    <td className="p-1">
                      <select
                        value={s.parentKey ?? ""}
                        onChange={(e) => update(i, { parentKey: e.target.value || null })}
                        className="input"
                        aria-label={`Step ${i + 1} parent`}
                      >
                        <option value="">— root —</option>
                        {steps
                          .filter((p) => !blocked.has(p.key))
                          .map((p) => (
                            <option key={p.key} value={p.key}>
                              {steps.indexOf(p) + 1}. {p.digimonName || "(unnamed)"}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={s.unlockLevel ?? ""}
                        onChange={(e) => update(i, { unlockLevel: e.target.value ? Number(e.target.value) : null })}
                        className="input w-24"
                        aria-label={`Step ${i + 1} unlock level`}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        value={s.requiredItem ?? ""}
                        onChange={(e) => update(i, { requiredItem: e.target.value || null })}
                        className="input"
                        aria-label={`Step ${i + 1} required item`}
                      />
                    </td>
                    <td className="p-1">
                      <select value={s.kind} onChange={(e) => update(i, { kind: e.target.value as Step["kind"] })} className="input" aria-label={`Step ${i + 1} kind`}>
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {k.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap p-1 text-right">
                      <button type="button" aria-label="Move up" className="p-1 text-muted hover:text-text disabled:opacity-30" disabled={i === 0} onClick={() => setSteps((st) => { const n = [...st]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}>
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Move down" className="p-1 text-muted hover:text-text disabled:opacity-30" disabled={i === steps.length - 1} onClick={() => setSteps((st) => { const n = [...st]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}>
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove step"
                        className="p-1 text-muted hover:text-danger"
                        onClick={() =>
                          // children of a removed step re-attach to its parent
                          setSteps((st) => st.filter((x) => x.key !== s.key).map((x) => (x.parentKey === s.key ? { ...x, parentKey: s.parentKey } : x)))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save line"}
        </button>
        {initial.id && (
          <button
            className="btn-ghost text-danger"
            disabled={pending}
            onClick={() => confirm("Delete this evolution line?") && start(() => deleteEvolutionLine(initial.id!))}
          >
            Delete line
          </button>
        )}
        {status.error && (
          <span role="alert" className="text-sm text-danger">
            {status.error}
          </span>
        )}
        {status.ok && (
          <span role="status" className="text-sm text-ok">
            {status.ok}
          </span>
        )}
      </div>
    </div>
  );
}
