import Link from "next/link";
import { EvolutionTree } from "@/components/evolution-tree";
import { attackTypeLabel } from "@/lib/wikitext/digimon";
import { mediaUrl, mediaUrlForKey } from "@/lib/media";
import { categoryHref } from "@/lib/slug";
import type { getDigimonByPage, getEvolutionLinesFor } from "@/lib/queries";

type Digimon = NonNullable<Awaited<ReturnType<typeof getDigimonByPage>>>;
type Lines = Awaited<ReturnType<typeof getEvolutionLinesFor>>;

const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  ds: "DS",
  at: "Attack",
  as: "Attack Speed",
  ct: "Critical",
  ht: "Hit Rate",
  de: "Defense",
  ev: "Evade",
  bl: "Block",
  sk: "Skill",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="flex justify-between gap-3 border-t border-border px-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export function DigimonInfobox({ d }: { d: Digimon }) {
  const img = d.image ? mediaUrlForKey(d.image.r2Key) : mediaUrl(`${d.slug.replace(/_/g, " ")}.png`);
  const names = d.names ?? {};
  return (
    <aside className="card w-full overflow-hidden lg:w-80 lg:shrink-0">
      <div className="bg-panel-2 px-4 py-3 text-center">
        <div className="text-lg font-bold">{d.name}</div>
        {names.katakana && <div className="text-sm text-muted">{names.katakana}</div>}
      </div>
      <div className="grid place-items-center bg-bg-soft p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={d.name} className="max-h-72 w-auto object-contain" />
      </div>
      <Row label="Stage">{d.stage && <Link href={categoryHref(d.stage)}>{d.stage}</Link>}</Row>
      <Row label="Attribute">{d.attribute}</Row>
      <Row label="Element">{d.naturalAttribute}</Row>
      <Row label="Attacker type">{attackTypeLabel(d.attackType)}</Row>
      <Row label="Type">{d.digimonType}</Row>
      <Row label="Rank">{d.rank}</Row>
      <Row label="Families">
        {d.families.length ? (
          <span className="flex flex-wrap justify-end gap-1">
            {d.families.map((f) => (
              <Link key={f.family} href={categoryHref(f.family)} className="rounded bg-panel-2 px-1.5 py-0.5 text-xs">
                {f.family}
              </Link>
            ))}
          </span>
        ) : null}
      </Row>
      <Row label="Location">{d.location}</Row>
      <Row label="Rideable">{d.rideable ? "Yes" : "No"}</Row>
      {d.egg && <Row label="Egg">{d.egg}</Row>}
      {d.enemy && <Row label="Kind">Enemy / Raid</Row>}
      {names.korean && <Row label="Korean">{names.korean}</Row>}
      {names.hongkong && <Row label="Chinese">{names.hongkong}</Row>}
      {names.thai && <Row label="Thai">{names.thai}</Row>}
    </aside>
  );
}

export function DigimonSections({ d, lines }: { d: Digimon; lines: Lines }) {
  const stats = d.stats ?? {};
  const statKeys = [...new Set([...Object.keys(stats.max ?? {}), ...Object.keys(stats.base ?? {})])];
  return (
    <div className="space-y-6">
      {lines.length > 0 && (
        <section>
          <h2 className="mb-3 border-b border-border pb-1 text-xl font-bold text-accent">Digivolves</h2>
          <div className="space-y-3">
            {lines.map((l) => (
              <div key={l.id} className="card p-3">
                <EvolutionTree steps={l.steps} current={d.name} />
              </div>
            ))}
          </div>
        </section>
      )}

      {statKeys.length > 0 && (
        <section>
          <h2 className="mb-3 border-b border-border pb-1 text-xl font-bold text-accent">Default Stats</h2>
          {stats.note && <p className="mb-2 text-sm text-muted">{stats.note}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-panel-2 text-left">
                  <th className="px-3 py-2">Stat</th>
                  <th className="px-3 py-2">Base (Lv. 1)</th>
                  <th className="px-3 py-2">Max</th>
                </tr>
              </thead>
              <tbody>
                {statKeys.map((k) => (
                  <tr key={k} className="border-t border-border">
                    <td className="px-3 py-1.5 text-muted">{STAT_LABELS[k] ?? k.toUpperCase()}</td>
                    <td className="px-3 py-1.5">{stats.base?.[k] ?? "—"}</td>
                    <td className="px-3 py-1.5 font-medium">{stats.max?.[k] ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {d.attacks.length > 0 && (
        <section>
          <h2 className="mb-3 border-b border-border pb-1 text-xl font-bold text-accent">Attacks</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {d.attacks.map((a) => (
              <div key={a.id} className="card flex gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(`${a.iconName ?? a.name}.png`)}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded"
                  loading="lazy"
                />
                <div className="min-w-0 text-sm">
                  <div className="font-semibold">
                    {a.name} {a.element && <span className="ml-1 text-xs text-accent-2">{a.element}</span>}
                  </div>
                  {a.description && <p className="text-muted">{a.description}</p>}
                  <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                    {a.baseDamage && (
                      <span>
                        Dmg <b className="text-text">{a.baseDamage}</b>
                        {a.upgrade ? ` (+${a.upgrade}/lv)` : ""}
                      </span>
                    )}
                    {a.cooldown && (
                      <span>
                        CD <b className="text-text">{a.cooldown}s</b>
                      </span>
                    )}
                    {a.dsCost && (
                      <span>
                        DS <b className="text-text">{a.dsCost}</b>
                      </span>
                    )}
                    {a.skillPoints && (
                      <span>
                        SP <b className="text-text">{a.skillPoints}</b>
                      </span>
                    )}
                    {a.animation && (
                      <span>
                        Anim <b className="text-text">{a.animation}s</b>
                      </span>
                    )}
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
