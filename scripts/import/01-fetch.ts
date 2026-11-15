/* eslint-disable @typescript-eslint/no-explicit-any -- raw MediaWiki API JSON */
/**
 * Step 1: download wikitext, categories, rendered HTML and the image list from dmowiki.com
 * into .import-cache/ (resumable — cached files are skipped).
 *
 *   npm run import:fetch [-- --limit 50] [-- --skip-html]
 */
import fs from "node:fs";
import { api, arg, htmlFile, imagesFile, nsFile, readJson, writeJson, type RawImage, type RawPage } from "./lib";

const NAMESPACES = [0, 10, 14]; // main, Template, Category
const limit = arg("limit") ? Number(arg("limit")) : Infinity;

async function fetchNamespace(ns: number) {
  const file = nsFile(ns);
  if (fs.existsSync(file) && !arg("refresh")) {
    const cached = readJson<RawPage[]>(file);
    console.log(`ns ${ns}: ${cached.length} pages (cached)`);
    return cached;
  }
  const pages = new Map<number, RawPage>();
  let cont: Record<string, string> = {};
  do {
    const res = await api<any>({
      action: "query",
      generator: "allpages",
      gapnamespace: ns,
      gaplimit: 50,
      prop: "revisions|categories|info",
      rvprop: "content|ids",
      rvslots: "main",
      cllimit: "max",
      clprop: "hidden",
      ...cont,
    });
    for (const p of (res.query?.pages ?? []) as RawPage[]) {
      const prev = pages.get(p.pageid);
      if (!prev) pages.set(p.pageid, p);
      else {
        prev.revisions ??= p.revisions;
        prev.categories = [...(prev.categories ?? []), ...(p.categories ?? [])];
      }
    }
    cont = res.continue ?? {};
    process.stdout.write(`\rns ${ns}: ${pages.size} pages`);
    if (pages.size >= limit && !cont.clcontinue && !cont.rvcontinue) break;
  } while (Object.keys(cont).length);
  process.stdout.write("\n");
  const list = [...pages.values()];
  writeJson(file, list);
  return list;
}

async function fetchHtml(pages: RawPage[]) {
  const todo = pages.filter((p) => p.ns === 0 && !p.redirect && !fs.existsSync(htmlFile(p.pageid)));
  console.log(`html: ${todo.length} pages to render`);
  let n = 0;
  for (const p of todo) {
    const res = await api<any>({ action: "parse", pageid: p.pageid, prop: "text|displaytitle", disableeditsection: 1, disablelimitreport: 1 }, 350);
    writeJson(htmlFile(p.pageid), { pageid: p.pageid, title: p.title, html: res.parse?.text ?? "" });
    n++;
    if (n % 25 === 0 || n === todo.length) process.stdout.write(`\rhtml: ${n}/${todo.length}`);
  }
  process.stdout.write("\n");
}

async function fetchImages() {
  const file = imagesFile();
  if (fs.existsSync(file) && !arg("refresh")) {
    console.log(`images: ${readJson<RawImage[]>(file).length} (cached)`);
    return;
  }
  const images: RawImage[] = [];
  let cont: Record<string, string> = {};
  do {
    const res = await api<any>({ action: "query", list: "allimages", ailimit: 500, aiprop: "url|size|mime|dimensions", ...cont });
    images.push(...res.query.allimages);
    cont = res.continue ?? {};
    process.stdout.write(`\rimages: ${images.length}`);
  } while (Object.keys(cont).length);
  process.stdout.write("\n");
  writeJson(file, images);
}

async function main() {
  const all: RawPage[] = [];
  for (const ns of NAMESPACES) all.push(...(await fetchNamespace(ns)));
  await fetchImages();
  if (!arg("skip-html")) {
    const main = all.filter((p) => p.ns === 0).slice(0, limit);
    await fetchHtml(main);
  }
  console.log("fetch done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
