import Link from "next/link";
import { iconUrl } from "@/lib/media";
import { wikiHref } from "@/lib/slug";

export type TreeStep = {
  id: number;
  digimonName: string;
  slug: string | null;
  parentStepId: number | null;
  unlockLevel: number | null;
  requiredItem: string | null;
  kind: string;
};

type Placed = { step: TreeStep; row: number; col: number; branch: boolean; parent?: TreeStep };

const KIND_LABEL: Record<string, string> = {
  burst: "Burst Mode",
  side_mega: "Side Mega",
  jogress: "Jogress",
  armor: "Armor",
};

/** Lay a tree out on a grid: the first child continues the parent's row, later children start new rows. */
export function layoutTree(steps: TreeStep[]) {
  const children = new Map<number | null, TreeStep[]>();
  const ids = new Set(steps.map((s) => s.id));
  for (const s of steps) {
    const p = s.parentStepId !== null && ids.has(s.parentStepId) ? s.parentStepId : null;
    const arr = children.get(p) ?? [];
    arr.push(s);
    children.set(p, arr);
  }
  const placed: Placed[] = [];
  let nextRow = 0;
  const visit = (s: TreeStep, row: number, col: number, branch: boolean, parent?: TreeStep) => {
    placed.push({ step: s, row, col, branch, parent });
    const kids = children.get(s.id) ?? [];
    kids.forEach((k, i) => {
      if (i === 0) visit(k, row, col + 1, false, s);
      else visit(k, ++nextRow, col + 1, true, s);
    });
  };
  for (const root of children.get(null) ?? []) {
    visit(root, nextRow, 0, false);
    nextRow++;
  }
  const rows = Math.max(0, ...placed.map((p) => p.row)) + 1;
  const cols = Math.max(0, ...placed.map((p) => p.col)) + 1;
  return { placed, rows, cols };
}

function Node({ p, current }: { p: Placed; current?: string }) {
  const s = p.step;
  const isCurrent = current && s.digimonName.toLowerCase() === current.toLowerCase();
  const inner = (
    <div
      className={`flex w-[84px] flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-colors ${
        isCurrent ? "border-accent bg-accent/10" : "border-border bg-panel-2 hover:border-accent-2"
      } ${s.slug ? "" : "opacity-60"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconUrl(s.digimonName)} alt="" width={46} height={46} loading="lazy" className="h-[46px] w-[46px] rounded-md object-contain" />
      <span className="line-clamp-2 text-[11px] leading-tight text-text">{s.digimonName}</span>
      {KIND_LABEL[s.kind] && (
        <span className="rounded bg-accent-2/15 px-1 text-[9px] font-semibold uppercase text-accent-2">{KIND_LABEL[s.kind]}</span>
      )}
    </div>
  );
  return s.slug ? (
    <Link href={wikiHref(s.slug)} title={s.digimonName} className="no-underline">
      {inner}
    </Link>
  ) : (
    <div title={`${s.digimonName} (no page yet)`}>{inner}</div>
  );
}

function Edge({ p }: { p: Placed }) {
  const s = p.step;
  return (
    <div className="flex min-w-[54px] flex-col items-center justify-center px-1 text-center" title={p.parent ? `from ${p.parent.digimonName}` : undefined}>
      <span className="text-lg leading-none text-accent">{p.branch ? "↳" : "→"}</span>
      {s.unlockLevel != null && <span className="text-[10px] text-muted">Lv. {s.unlockLevel}</span>}
      {s.requiredItem && <span className="max-w-[80px] text-[10px] leading-tight text-accent-2">{s.requiredItem}</span>}
    </div>
  );
}

/** Phone layout: one step per row, indented by depth (rows are already in depth-first order). */
function TreeList({ placed, current }: { placed: Placed[]; current?: string }) {
  return (
    <ol className="space-y-1.5">
      {placed.map((p) => {
        const s = p.step;
        const isCurrent = current && s.digimonName.toLowerCase() === current.toLowerCase();
        const depth = Math.min(p.col, 5);
        const body = (
          <span
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2 py-1.5 ${
              isCurrent ? "border-accent bg-accent/10" : "border-border bg-panel-2"
            } ${s.slug ? "" : "opacity-60"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconUrl(s.digimonName)} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 shrink-0 rounded object-contain" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-text">{s.digimonName}</span>
              {(s.unlockLevel != null || s.requiredItem || KIND_LABEL[s.kind]) && (
                <span className="flex flex-wrap gap-x-2 text-[11px] text-muted">
                  {s.unlockLevel != null && <span>Lv. {s.unlockLevel}</span>}
                  {s.requiredItem && <span className="text-accent-2">{s.requiredItem}</span>}
                  {KIND_LABEL[s.kind] && <span className="font-semibold uppercase text-accent-2">{KIND_LABEL[s.kind]}</span>}
                </span>
              )}
            </span>
          </span>
        );
        return (
          <li key={s.id} className="flex items-center gap-1" style={{ paddingLeft: `${depth * 14}px` }}>
            {p.col > 0 && (
              <span aria-hidden className="w-4 shrink-0 text-center text-accent">
                {p.branch ? "↳" : "↓"}
              </span>
            )}
            {s.slug ? (
              <Link href={wikiHref(s.slug)} className="flex min-w-0 flex-1 no-underline">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function EvolutionTree({ steps, current }: { steps: TreeStep[]; current?: string }) {
  const { placed, rows, cols } = layoutTree(steps);
  if (!placed.length) return null;
  const at = new Map(placed.map((p) => [`${p.row}:${p.col}`, p]));
  return (
    <>
    <div className="sm:hidden">
      <TreeList placed={placed} current={current} />
    </div>
    <div className="hidden overflow-x-auto pb-2 sm:block">
      <div className="grid w-max gap-y-3" style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}>
        {Array.from({ length: rows }).flatMap((_, r) =>
          Array.from({ length: cols }).map((__, c) => {
            const p = at.get(`${r}:${c}`);
            return (
              <div key={`${r}:${c}`} className="flex items-center">
                {p ? (
                  <>
                    {c > 0 && <Edge p={p} />}
                    <Node p={p} current={current} />
                  </>
                ) : (
                  <div />
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
    </>
  );
}
