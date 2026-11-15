import { cleanSource, findTemplate, findTemplates, isYes, wikiToPlain } from "./templates";

export type ParsedAttack = {
  position: number;
  name: string;
  iconName?: string;
  element?: string;
  cooldown?: string;
  dsCost?: string;
  skillPoints?: string;
  animation?: string;
  baseDamage?: string;
  upgrade?: string;
  description?: string;
  extra: Record<string, string>;
};

export type ParsedDigimon = {
  name: string;
  names: Record<string, string>;
  stage?: string;
  attribute?: string;
  naturalAttribute?: string;
  attackType?: string;
  digimonType?: string;
  rank?: string;
  location?: string;
  rideable: boolean;
  egg?: string;
  gdmo: boolean;
  kdmo: boolean;
  families: string[];
  image?: string;
  stats: { base?: Record<string, string>; max?: Record<string, string>; note?: string };
  attacks: ParsedAttack[];
  enemy: boolean;
  raw: Record<string, string>;
};

const ATTACK_TYPES: Record<string, string> = {
  SA: "Short Attacker",
  NA: "Near Attacker",
  QA: "Quick Attacker",
  DE: "Defender",
  CA: "Close Attacker",
  LA: "Long Attacker",
  MA: "Magic Attacker",
};

export function attackTypeLabel(code?: string | null) {
  if (!code) return "";
  return ATTACK_TYPES[code.toUpperCase()] ?? code;
}

const clean = (v?: string) => {
  const t = wikiToPlain(v);
  return t ? t : undefined;
};

export function parseDigimon(title: string, wikitext: string, categories: string[]): ParsedDigimon | null {
  const src = cleanSource(wikitext);
  const enemyBox = findTemplate(src, "Enemy Infobox");
  const box = findTemplate(src, "Digimon Infobox") ?? enemyBox;
  if (!box) return null;
  const p = box.params;

  const families = ["family", "family2", "family3", "family4", "family5"]
    .map((k) => clean(p[k]))
    .filter((v): v is string => !!v);

  const names: Record<string, string> = {};
  for (const [k, label] of [
    ["katakana", "katakana"],
    ["japname", "japanese"],
    ["koreanname", "korean"],
    ["hkname", "hongkong"],
    ["thainame", "thai"],
    ["engname", "english"],
  ] as const) {
    const v = clean(p[k]);
    if (v) names[label] = v;
  }

  const rankCat = categories.find((c) => /^Digimon Rank /i.test(c));

  // stats
  const stats: ParsedDigimon["stats"] = {};
  const statsCall = findTemplate(src, "stats");
  if (statsCall) {
    const base: Record<string, string> = {};
    const max: Record<string, string> = {};
    for (const [k, v] of Object.entries(statsCall.params)) {
      const val = wikiToPlain(v);
      if (!val) continue;
      if (/^base\s+/i.test(k)) base[k.replace(/^base\s+/i, "").toLowerCase()] = val;
      else max[k.toLowerCase()] = val;
    }
    if (Object.keys(base).length) stats.base = base;
    if (Object.keys(max).length) stats.max = max;
  }
  const note = findTemplate(src, "note");
  if (note?.params["1"]) stats.note = wikiToPlain(note.params["1"]);

  // attacks: {{Digimon Attacks 2}} / {{Digimon Attacks}}
  const attacks: ParsedAttack[] = [];
  const atkCall = findTemplates(src).find((t) => /^digimon attacks/.test(t.key));
  if (atkCall) {
    const ap = atkCall.params;
    for (let i = 1; i <= 12; i++) {
      const name = clean(ap[`attack${i}`]);
      if (!name) continue;
      const known = new Set([
        `attack${i}`,
        `atk${i}imgid`,
        `attribute${i}`,
        `cooldown${i}`,
        `atk${i}ds`,
        `skillpoint${i}`,
        `anim${i}`,
        `atk${i}desc`,
        `atk${i}lv1`,
        `atk${i}upgrade`,
      ]);
      const extra: Record<string, string> = {};
      for (const [k, v] of Object.entries(ap)) {
        if (known.has(k) || !v) continue;
        if (new RegExp(`^atk${i}[^0-9]`).test(k) || new RegExp(`^[a-z_]+${i}$`, "i").test(k)) {
          extra[k] = wikiToPlain(v);
        }
      }
      attacks.push({
        position: i,
        name,
        iconName: clean(ap[`atk${i}imgid`]),
        element: clean(ap[`attribute${i}`]),
        cooldown: clean(ap[`cooldown${i}`]),
        dsCost: clean(ap[`atk${i}ds`]),
        skillPoints: clean(ap[`skillpoint${i}`]),
        animation: clean(ap[`anim${i}`]),
        baseDamage: clean(ap[`atk${i}lv1`]),
        upgrade: clean(ap[`atk${i}upgrade`]),
        description: clean(ap[`atk${i}desc`]),
        extra,
      });
    }
  }

  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) raw[k] = v;

  return {
    name: clean(p.name) ?? title,
    names,
    stage: clean(p.form),
    attribute: clean(p.attribute),
    naturalAttribute: clean(p.naturalattribute),
    attackType: clean(p.atttype),
    digimonType: clean(p.type),
    rank: clean(p.rank) ?? rankCat?.replace(/^Digimon Rank /i, ""),
    location: clean(p.location),
    rideable: isYes(p.riding),
    egg: clean(p.egg),
    gdmo: isYes(p.gdmo),
    kdmo: isYes(p.kdmo),
    families,
    image: clean(p.image),
    stats,
    attacks,
    enemy: !!enemyBox && box === enemyBox,
    raw,
  };
}
