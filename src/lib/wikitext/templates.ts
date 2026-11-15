/**
 * Minimal MediaWiki template-call parser.
 * Finds `{{Name|a=b|c}}` calls (respecting nested {{ }}, {{{ }}} and [[ ]]) and splits
 * their parameters on top-level pipes.
 */

export type TemplateCall = {
  name: string;
  /** Normalised lower-case name with underscores -> spaces */
  key: string;
  params: Record<string, string>;
  start: number;
  end: number;
  raw: string;
};

export function normaliseTemplateName(name: string) {
  return name.replace(/_/g, " ").replace(/\s+/g, " ").trim().replace(/^template:/i, "").toLowerCase();
}

/** Strip HTML comments and <noinclude> blocks; unwrap <includeonly>/<onlyinclude>. */
export function cleanSource(src: string) {
  return src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<noinclude>[\s\S]*?<\/noinclude>/gi, "")
    .replace(/<\/?(includeonly|onlyinclude)>/gi, "");
}

/** Find the index of the matching `}}` for a `{{` at `start`, or -1. */
function findClose(src: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < src.length) {
    if (src.startsWith("{{", i)) {
      depth++;
      i += 2;
    } else if (src.startsWith("}}", i)) {
      depth--;
      i += 2;
      if (depth === 0) return i;
    } else {
      i++;
    }
  }
  return -1;
}

function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let curly = 0;
  let square = 0;
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{") {
      curly++;
      cur += two;
      i++;
      continue;
    }
    if (two === "}}" && curly > 0) {
      curly--;
      cur += two;
      i++;
      continue;
    }
    if (two === "[[") {
      square++;
      cur += two;
      i++;
      continue;
    }
    if (two === "]]" && square > 0) {
      square--;
      cur += two;
      i++;
      continue;
    }
    const ch = body[i];
    if (ch === "|" && curly === 0 && square === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

function parseCall(raw: string, start: number, end: number): TemplateCall | null {
  const body = raw.slice(2, -2);
  if (body.startsWith("{") || body.startsWith("#")) return null; // parameter or parser function
  const parts = splitTopLevel(body);
  const name = parts[0].trim();
  if (!name || name.includes("\n\n")) return null;
  const params: Record<string, string> = {};
  let positional = 1;
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    // an '=' inside nested template/link doesn't count: check prefix has no braces
    if (eq > -1 && !/[{[]/.test(part.slice(0, eq))) {
      params[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    } else {
      params[String(positional++)] = part.trim();
    }
  }
  return { name, key: normaliseTemplateName(name), params, start, end, raw };
}

/** All template calls in `src`. With `recursive`, also returns calls nested inside params. */
export function findTemplates(src: string, opts: { recursive?: boolean } = {}): TemplateCall[] {
  const out: TemplateCall[] = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{{", i);
    if (open === -1) break;
    // skip triple-brace parameters {{{x}}}
    if (src.startsWith("{{{", open) && !src.startsWith("{{{{", open)) {
      const close = src.indexOf("}}}", open);
      i = close === -1 ? open + 3 : close + 3;
      continue;
    }
    const end = findClose(src, open);
    if (end === -1) break;
    const raw = src.slice(open, end);
    const call = parseCall(raw, open, end);
    if (call) {
      out.push(call);
      if (opts.recursive) {
        for (const nested of findTemplates(raw.slice(2, -2), opts)) {
          out.push({ ...nested, start: nested.start + open + 2, end: nested.end + open + 2 });
        }
      }
    } else if (opts.recursive) {
      for (const nested of findTemplates(raw.slice(2, -2), opts)) {
        out.push({ ...nested, start: nested.start + open + 2, end: nested.end + open + 2 });
      }
    }
    i = end;
  }
  return out;
}

export function findTemplate(src: string, name: string) {
  const key = normaliseTemplateName(name);
  return findTemplates(src).find((t) => t.key === key);
}

/** Turn simple wikitext into plain text (links, bold/italics, templates removed). */
export function wikiToPlain(text: string | undefined | null): string {
  if (!text) return "";
  return cleanSource(text)
    .replace(/[‎‏​﻿]/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function isYes(v: string | undefined) {
  if (!v) return false;
  return /^(yes|y|1|true)$/i.test(v.trim());
}
