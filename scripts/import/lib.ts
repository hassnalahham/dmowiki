/* eslint-disable @typescript-eslint/no-explicit-any -- raw MediaWiki API JSON */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

export const SOURCE = "https://dmowiki.com";
export const API = `${SOURCE}/api.php`;
export const CACHE_DIR = path.resolve(process.cwd(), ".import-cache");
const UA = "private-wiki-mirror-importer/0.1";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "true";
}

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function readJson<T>(file: string, fallback?: T): T {
  if (!fs.existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing ${file}. Run "npm run import:fetch" first.`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function writeJson(file: string, data: unknown) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data));
}

let last = 0;
/** Throttled MediaWiki API GET with retries. */
export async function api<T = any>(params: Record<string, string | number>, delayMs = 400): Promise<T> {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  for (let attempt = 1; ; attempt++) {
    const wait = last + delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const res = await fetch(`${API}?${qs}`, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip" } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as any;
      if (json.error) throw new Error(`API error ${json.error.code}: ${json.error.info}`);
      return json as T;
    } catch (e) {
      if (attempt >= 5) throw e;
      console.warn(`  retry ${attempt} after error: ${(e as Error).message}`);
      await sleep(2000 * attempt);
    }
  }
}

export async function download(url: string): Promise<{ body: Buffer; type: string | null }> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return { body: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") };
    } catch (e) {
      if (attempt >= 4) throw e;
      await sleep(1500 * attempt);
    }
  }
}

export type RawPage = {
  pageid: number;
  ns: number;
  title: string;
  redirect?: boolean;
  lastrevid?: number;
  revisions?: { revid: number; slots: { main: { content: string } } }[];
  categories?: { title: string; hidden?: boolean }[];
};

export type RawImage = {
  name: string;
  title: string;
  url: string;
  size: number;
  width: number;
  height: number;
  mime: string;
};

export const nsFile = (ns: number) => path.join(CACHE_DIR, `ns-${ns}.json`);
export const htmlFile = (pageid: number) => path.join(CACHE_DIR, "html", `${pageid}.json`);
export const imagesFile = () => path.join(CACHE_DIR, "images.json");

export async function pool<T>(items: T[], concurrency: number, fn: (item: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    }),
  );
}
