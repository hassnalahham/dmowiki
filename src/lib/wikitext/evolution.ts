import { cleanSource, findTemplates, normaliseTemplateName, wikiToPlain } from "./templates";

export type EvoKind = "normal" | "burst" | "side_mega" | "jogress" | "armor";

export type ParsedStep = {
  key: number;
  name: string;
  parentKey: number | null;
  level: number | null;
  item: string | null;
  kind: EvoKind;
};

/** Templates that *render* an evolution line from numbered params. */
const LINE_RENDERERS = new Set(["digivolve", "digivolve 2", "digivolve2"]);

export function isLineRenderer(templateKey: string) {
  return LINE_RENDERERS.has(templateKey);
}

/** Is this a per-Digimon evolution template name like "Digivolve Agumon"? */
export function isEvolutionTemplate(templateKey: string) {
  return templateKey.startsWith("digivolve") && !LINE_RENDERERS.has(templateKey);
}

const DEFAULT_LEVELS: Record<number, number> = { 2: 11, 3: 25, 4: 41, 5: 65, 6: 70 };

const num = (v?: string) => {
  if (!v) return null;
  const m = v.match(/\d+/);
  return m ? Number(m[0]) : null;
};

/** Parse a `{{Digivolve|1=..|2=..}}` call into steps. */
export function parseStructuredLine(params: Record<string, string>): ParsedStep[] {
  const steps: ParsedStep[] = [];
  let prevKey: number | null = null;
  let firstKey: number | null = null;
  let key = 0;
  for (let slot = 1; slot <= 9; slot++) {
    const name = wikiToPlain(params[String(slot)]);
    if (!name) continue;
    const sm = slot >= 5 && (!!params[`${slot}sm`] || (slot === 5 && !!params.sm));
    let kind: EvoKind = "normal";
    if (slot >= 5) kind = sm ? "side_mega" : /burst mode/i.test(name) || slot === 5 ? "burst" : "normal";
    if (/burst mode/i.test(name)) kind = "burst";
    const step: ParsedStep = {
      key: key++,
      name,
      parentKey: prevKey,
      level: slot === 1 ? null : (num(params[`${slot}lv`]) ?? DEFAULT_LEVELS[slot] ?? null),
      item: wikiToPlain(params[`${slot}item`]) || null,
      kind,
    };
    steps.push(step);
    if (firstKey === null) firstKey = step.key;
    prevKey = step.key;
  }

  // Armor evolutions branch from the first (rookie) slot
  for (const suffix of ["", "2", "3", "4", "5", "_champion"]) {
    const name = wikiToPlain(params[`armor${suffix}`]);
    if (!name) continue;
    steps.push({
      key: key++,
      name,
      parentKey: firstKey,
      level: num(params[`armor${suffix}level`]),
      item: wikiToPlain(params[`armor${suffix}item`]) || null,
      kind: "armor",
    });
  }
  return steps;
}

type Cell = { type: "digi"; name: string } | { type: "right" | "down" | "branch" | "empty" };

function classify(cell: string): Cell {
  const digi = cell.match(/\{\{\s*digi\s*\|\s*([^|}]+)/i) ?? cell.match(/\[\[\s*File:\s*([^|\]]+?)\s+Icon\.png/i);
  if (digi) return { type: "digi", name: digi[1].replace(/_/g, " ").trim() };
  if (/→|&rarr;|\{\{\s*arrow/i.test(cell)) return { type: "right" };
  if (/↳/.test(cell)) return { type: "branch" };
  if (/↓|&darr;/.test(cell)) return { type: "down" };
  return { type: "empty" };
}

/** Parse a hand-written wikitable evolution tree built from {{digi|X}} {{→}} {{↓}} {{↳}} cells. */
export function parseGridTree(src: string): ParsedStep[] {
  const body = cleanSource(src)
    .split("\n")
    .filter((l) => !/^\s*\{\|/.test(l) && !/^\s*\|\}/.test(l))
    .join("\n");
  const rows = body.split(/^\s*\|-.*$/m);
  const grid: Cell[][] = rows.map((row) => {
    const text = row
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|") || l.startsWith("!"))
      .map((l) => l.slice(1))
      .join("||");
    return text.split(/\|\||!!/).map((c) => classify(c));
  });

  const steps: ParsedStep[] = [];
  const at = new Map<string, number>(); // "row:col" -> step key

  const findDigiLeft = (r: number, c: number) => {
    for (let k = c - 1; k >= 0; k--) if (grid[r][k]?.type === "digi") return at.get(`${r}:${k}`) ?? null;
    return null;
  };

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.type !== "digi") continue;
      let parent: number | null = null;
      // a ↓ directly above wins: walk straight up the column to the source digi
      if (r > 0 && grid[r - 1][c]?.type === "down") {
        for (let rr = r - 2; rr >= 0; rr--) {
          if (grid[rr][c]?.type === "digi") {
            parent = at.get(`${rr}:${c}`) ?? null;
            break;
          }
        }
      }
      // scan left for the nearest non-empty cell
      let k = c - 1;
      while (k >= 0 && grid[r][k].type === "empty") k--;
      if (parent === null && k >= 0) {
        const left = grid[r][k];
        if (left.type === "digi" || left.type === "right") {
          parent = findDigiLeft(r, k + 1);
        } else if (left.type === "branch") {
          // nearest row above with a digi at column <= branch column, rightmost
          for (let rr = r - 1; rr >= 0 && parent === null; rr--) {
            for (let cc = Math.min(k, grid[rr].length - 1); cc >= 0; cc--) {
              if (grid[rr][cc]?.type === "digi") {
                parent = at.get(`${rr}:${cc}`) ?? null;
                break;
              }
            }
          }
        } else if (left.type === "down") {
          parent = findDigiLeft(r, k);
        }
      }
      if (parent === null && k < 0) {
        // first thing in the row: look straight up the same column (through ↓ cells)
        for (let rr = r - 1; rr >= 0; rr--) {
          const up = grid[rr][c];
          if (up?.type === "digi") {
            parent = at.get(`${rr}:${c}`) ?? null;
            break;
          }
        }
      }
      const key = steps.length;
      at.set(`${r}:${c}`, key);
      steps.push({
        key,
        name: cell.name,
        parentKey: parent,
        level: null,
        item: null,
        kind: /burst mode/i.test(cell.name) ? "burst" : "normal",
      });
    }
  }
  return steps;
}

/**
 * Parse every evolution line found in a piece of wikitext (a Digivolve template body or a page).
 * Returns one array of steps per line found.
 */
export function parseEvolutionLines(src: string): ParsedStep[][] {
  const cleaned = cleanSource(src);
  const lines: ParsedStep[][] = [];
  for (const call of findTemplates(cleaned)) {
    if (isLineRenderer(call.key)) {
      const steps = parseStructuredLine(call.params);
      if (steps.length) lines.push(steps);
    }
  }
  if (!lines.length && /\{\{\s*digi\s*\|/i.test(cleaned)) {
    // hand-written tables; there may be several
    const tables = cleaned.match(/\{\|[\s\S]*?\n\s*\|\}/g) ?? [cleaned];
    for (const t of tables) {
      if (!/\{\{\s*digi\s*\|/i.test(t)) continue;
      const steps = parseGridTree(t);
      if (steps.length) lines.push(steps);
    }
  }
  return lines;
}

/** Names of evolution templates transcluded by a page, e.g. "Digivolve Agumon". */
export function transcludedEvolutionTemplates(src: string): string[] {
  return findTemplates(cleanSource(src))
    .filter((t) => isEvolutionTemplate(t.key))
    .map((t) => t.name.replace(/_/g, " ").replace(/^template:/i, "").trim());
}

export { normaliseTemplateName };
