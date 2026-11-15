"use client";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveDigimon, type DigimonInput } from "@/app/dashboard/actions";
import { MediaPicker } from "./media-picker";
import { RichEditor } from "./rich-editor";

type Attack = DigimonInput["attacks"][number];
export type DigimonFormInitial = Omit<DigimonInput, "html" | "comment"> & {
  html: string;
  iconUrl?: string | null;
  imageUrl?: string | null;
};
export type Facets = { stages: string[]; attributes: string[]; elements: string[]; attackTypes: string[]; families: string[]; ranks: string[] };

const STAT_KEYS = ["hp", "ds", "at", "as", "ct", "ht", "de", "ev", "bl"];
const NAME_KEYS = [
  ["katakana", "Katakana"],
  ["japanese", "Japanese"],
  ["korean", "Korean"],
  ["hongkong", "Chinese"],
  ["thai", "Thai"],
] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Combo({ value, onChange, options, id }: { value?: string; onChange: (v: string) => void; options: string[]; id: string }) {
  return (
    <>
      <input list={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="input" />
      <datalist id={id}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

export function DigimonForm({ initial, facets }: { initial: DigimonFormInitial; facets: Facets }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useTransition();
  const [picker, setPicker] = useState<null | "icon" | "image">(null);
  const [previews, setPreviews] = useState({ icon: initial.iconUrl, image: initial.imageUrl });

  const set = <K extends keyof DigimonFormInitial>(k: K, val: DigimonFormInitial[K]) => setV((p) => ({ ...p, [k]: val }));
  const setAttack = (i: number, patch: Partial<Attack>) =>
    set(
      "attacks",
      v.attacks.map((a, j) => (j === i ? { ...a, ...patch } : a)),
    );

  const submit = (form: HTMLFormElement) => {
    const html = (form.elements.namedItem("html") as HTMLInputElement | null)?.value ?? v.html;
    setStatus({});
    start(async () => {
      const rest: Partial<DigimonFormInitial> = { ...v };
      delete rest.iconUrl;
      delete rest.imageUrl;
      const res = await saveDigimon({ ...(rest as DigimonFormInitial), html, comment });
      if (res?.error) return setStatus({ error: res.error });
      setStatus({ ok: "Saved" });
      if (!initial.id && res?.id) router.replace(`/dashboard/digimon/${res.id}`);
      else router.refresh();
    });
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
    >
      <section className="card grid gap-4 p-4 md:grid-cols-[160px_1fr]">
        <div className="space-y-3">
          {(["image", "icon"] as const).map((k) => (
            <div key={k}>
              <span className="label">{k === "image" ? "Artwork" : "Icon"}</span>
              <button
                type="button"
                onClick={() => setPicker(k)}
                className="grid w-full place-items-center rounded-lg border border-dashed border-border bg-bg-soft p-2 hover:border-accent-2"
                style={{ height: k === "image" ? 160 : 72 }}
              >
                {previews[k] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[k]!} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-muted">Choose…</span>
                )}
              </button>
              {v[k === "image" ? "imageMediaId" : "iconMediaId"] && (
                <button
                  type="button"
                  className="mt-1 text-xs text-muted hover:text-danger"
                  onClick={() => {
                    set(k === "image" ? "imageMediaId" : "iconMediaId", null);
                    setPreviews((p) => ({ ...p, [k]: null }));
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name">
            <input required value={v.name} onChange={(e) => set("name", e.target.value)} className="input" />
          </Field>
          <Field label="Stage">
            <Combo id="stages" value={v.stage} onChange={(x) => set("stage", x)} options={facets.stages} />
          </Field>
          <Field label="Attribute">
            <Combo id="attrs" value={v.attribute} onChange={(x) => set("attribute", x)} options={facets.attributes} />
          </Field>
          <Field label="Element">
            <Combo id="elems" value={v.naturalAttribute} onChange={(x) => set("naturalAttribute", x)} options={facets.elements} />
          </Field>
          <Field label="Attacker type (SA/QA/NA/DE…)">
            <Combo id="atks" value={v.attackType} onChange={(x) => set("attackType", x)} options={facets.attackTypes} />
          </Field>
          <Field label="Digimon type">
            <input value={v.digimonType ?? ""} onChange={(e) => set("digimonType", e.target.value)} className="input" />
          </Field>
          <Field label="Rank">
            <Combo id="ranks" value={v.rank} onChange={(x) => set("rank", x)} options={facets.ranks} />
          </Field>
          <Field label="Location">
            <input value={v.location ?? ""} onChange={(e) => set("location", e.target.value)} className="input" />
          </Field>
          <Field label="Egg">
            <input value={v.egg ?? ""} onChange={(e) => set("egg", e.target.value)} className="input" />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="label">Families</span>
            <div className="flex flex-wrap gap-1.5">
              {facets.families.map((f) => {
                const on = v.families.includes(f);
                return (
                  <button
                    type="button"
                    key={f}
                    aria-pressed={on}
                    onClick={() => set("families", on ? v.families.filter((x) => x !== f) : [...v.families, f])}
                    className={`rounded-md border px-2 py-1 text-xs ${on ? "border-accent bg-accent/15 text-text" : "border-border text-muted"}`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm sm:col-span-2 lg:col-span-3">
            {(
              [
                ["rideable", "Rideable"],
                ["enemy", "Enemy / raid"],
                ["gdmo", "GDMO"],
                ["kdmo", "KDMO"],
                ["published", "Published"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" checked={v[k]} onChange={(e) => set(k, e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                {label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Names in other regions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {NAME_KEYS.map(([k, label]) => (
            <Field key={k} label={label}>
              <input
                value={v.names[k] ?? ""}
                onChange={(e) => {
                  const names = { ...v.names, [k]: e.target.value };
                  if (!e.target.value) delete names[k];
                  set("names", names);
                }}
                className="input"
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Stats</h2>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="pr-3" />
                {STAT_KEYS.map((k) => (
                  <th key={k} className="px-1 pb-1 text-xs uppercase">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["statsBase", "statsMax"] as const).map((row) => (
                <tr key={row}>
                  <td className="pr-3 text-xs text-muted">{row === "statsBase" ? "Base" : "Max"}</td>
                  {STAT_KEYS.map((k) => (
                    <td key={k} className="p-1">
                      <input
                        aria-label={`${row === "statsBase" ? "Base" : "Max"} ${k}`}
                        value={v[row][k] ?? ""}
                        onChange={(e) => {
                          const next = { ...v[row], [k]: e.target.value };
                          if (!e.target.value) delete next[k];
                          set(row, next);
                        }}
                        className="input w-20 px-2 py-1"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <Field label="Stats note">
            <input value={v.statsNote ?? ""} onChange={(e) => set("statsNote", e.target.value)} className="input" />
          </Field>
        </div>
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Attacks</h2>
          <button type="button" className="btn-ghost" onClick={() => set("attacks", [...v.attacks, { name: "" }])}>
            <Plus className="h-4 w-4" /> Add attack
          </button>
        </div>
        <div className="space-y-3">
          {v.attacks.map((a, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border bg-bg-soft p-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Name">
                <input required value={a.name} onChange={(e) => setAttack(i, { name: e.target.value })} className="input" />
              </Field>
              <Field label="Icon file name">
                <input value={a.iconName ?? ""} onChange={(e) => setAttack(i, { iconName: e.target.value })} className="input" />
              </Field>
              <Field label="Element">
                <input value={a.element ?? ""} onChange={(e) => setAttack(i, { element: e.target.value })} className="input" />
              </Field>
              <Field label="Base dmg">
                <input value={a.baseDamage ?? ""} onChange={(e) => setAttack(i, { baseDamage: e.target.value })} className="input" />
              </Field>
              <Field label="+ per level">
                <input value={a.upgrade ?? ""} onChange={(e) => setAttack(i, { upgrade: e.target.value })} className="input" />
              </Field>
              <Field label="Cooldown (s)">
                <input value={a.cooldown ?? ""} onChange={(e) => setAttack(i, { cooldown: e.target.value })} className="input" />
              </Field>
              <Field label="DS cost">
                <input value={a.dsCost ?? ""} onChange={(e) => setAttack(i, { dsCost: e.target.value })} className="input" />
              </Field>
              <Field label="Skill points">
                <input value={a.skillPoints ?? ""} onChange={(e) => setAttack(i, { skillPoints: e.target.value })} className="input" />
              </Field>
              <Field label="Animation (s)">
                <input value={a.animation ?? ""} onChange={(e) => setAttack(i, { animation: e.target.value })} className="input" />
              </Field>
              <div className="flex items-end justify-end">
                <button type="button" className="btn-ghost text-danger" onClick={() => set("attacks", v.attacks.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </div>
              <div className="sm:col-span-2 lg:col-span-5">
                <Field label="Description">
                  <input value={a.description ?? ""} onChange={(e) => setAttack(i, { description: e.target.value })} className="input" />
                </Field>
              </div>
            </div>
          ))}
          {!v.attacks.length && <p className="text-sm text-muted">No attacks.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <Field label="Categories (comma separated — stage is added automatically)">
          <input value={v.categories} onChange={(e) => set("categories", e.target.value)} className="input" />
        </Field>
        <div>
          <span className="label">Article body (drops, notes, quests…)</span>
          <RichEditor name="html" initialHtml={initial.html} />
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-bg/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Edit summary (optional)" className="input max-w-md" aria-label="Edit summary" />
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save Digimon"}
        </button>
        {initial.id && (
          <Link href={`/dashboard/evolutions?q=${encodeURIComponent(v.name)}`} className="btn-ghost no-underline">
            Edit evolutions
          </Link>
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

      {picker && (
        <MediaPicker
          onClose={() => setPicker(null)}
          onPick={(m) => {
            set(picker === "image" ? "imageMediaId" : "iconMediaId", m.id);
            setPreviews((p) => ({ ...p, [picker]: m.url }));
            setPicker(null);
          }}
        />
      )}
    </form>
  );
}
