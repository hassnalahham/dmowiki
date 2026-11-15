import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import { categoryHref, titleToSlug, wikiHref } from "../slug";

import { mediaPath } from "../media-path";

export { MEDIA_PREFIX, mediaPath, resolveMediaUrls } from "../media-path";

/** "/images/thumb/b/b2/Agumon.png/250px-Agumon.png" -> "Agumon.png" */
export function fileFromImagePath(src: string): string | null {
  const m = src.match(/\/images\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, " ");
  } catch {
    return m[1].replace(/_/g, " ");
  }
}

function decodeTitle(path: string) {
  try {
    return decodeURIComponent(path).replace(/_/g, " ");
  } catch {
    return path.replace(/_/g, " ");
  }
}

export type TransformOptions = {
  /** remove the MediaWiki infobox (we render our own) */
  stripInfobox?: boolean;
  /** remove whole h2 sections with these headline ids (e.g. Digivolves, Attacks) */
  stripSections?: string[];
};

/** Convert MediaWiki parser output into clean HTML that points at our routes and R2 media. */
export function transformWikiHtml(html: string, opts: TransformOptions = {}): string {
  const $ = cheerio.load(html, null, false);

  $(".mw-editsection, script, style, link, meta, .noprint, #toc, .toc, .js-collapse-names").remove();
  $(".collapse-names-container-hidden").removeClass("collapse-names-container-hidden");
  if (opts.stripInfobox) $("#scraper-infobox").remove();

  for (const id of opts.stripSections ?? []) {
    const head = $(`h2:has(span.mw-headline#${id}), h2#${id}`).first();
    if (!head.length) continue;
    let el = head.next();
    while (el.length && !el.is("h2")) {
      const next = el.next();
      el.remove();
      el = next;
    }
    head.remove();
  }

  $("img").each((_, img) => {
    const $img = $(img);
    const src = $img.attr("src") ?? "";
    const file = fileFromImagePath(src);
    if (file) $img.attr("src", mediaPath(file));
    $img.removeAttr("srcset").removeAttr("decoding");
    $img.attr("loading", "lazy");
  });

  $("a").each((_, a) => {
    const $a = $(a);
    const href = $a.attr("href");
    if (!href) return;
    if (/^https?:\/\//i.test(href) || href.startsWith("#") || href.startsWith("mailto:")) {
      if (/^https?:\/\//i.test(href)) $a.attr("rel", "nofollow noopener").attr("target", "_blank");
      return;
    }
    // red links: /index.php?title=X&action=edit&redlink=1
    const red = href.match(/[?&]title=([^&]+)/);
    let path = red ? red[1] : href.replace(/^\//, "");
    let hash = "";
    const hi = path.indexOf("#");
    if (hi > -1) {
      hash = path.slice(hi);
      path = path.slice(0, hi);
    }
    const title = decodeTitle(path);
    if (/^File:/i.test(title)) {
      const file = title.replace(/^File:/i, "");
      $a.attr("href", mediaPath(file));
      $a.attr("target", "_blank");
      return;
    }
    if (/^Category:/i.test(title)) {
      $a.attr("href", categoryHref(title.replace(/^Category:/i, "")) + hash);
      return;
    }
    if (/^(Special|User|User talk|Talk|Template|MediaWiki|Wikipedia):/i.test(title)) {
      if (/^Wikipedia:/i.test(title)) {
        $a.attr("href", `https://en.wikipedia.org/wiki/${titleToSlug(title.replace(/^Wikipedia:/i, ""))}`);
        $a.attr("target", "_blank").attr("rel", "nofollow noopener");
      } else {
        $a.replaceWith($a.html() ?? "");
      }
      return;
    }
    $a.attr("href", (title ? wikiHref(title) : "/") + hash);
    if (red) $a.addClass("redlink");
    $a.removeAttr("title");
  });

  const out = $.html();
  return sanitizeHtml(out, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "center",
      "span",
      "font",
      "big",
      "small",
      "s",
      "u",
      "sup",
      "sub",
      "h1",
      "h2",
      "details",
      "summary",
    ]),
    allowedAttributes: {
      "*": ["class", "id", "style", "title", "colspan", "rowspan", "align", "valign", "width", "height", "lang", "dir"],
      a: ["href", "target", "rel", "class", "id", "style", "title"],
      img: ["src", "alt", "width", "height", "loading", "class", "style", "title"],
      font: ["color", "size"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
  });
}


/** Plain-text summary from HTML (first meaningful paragraph). */
export function summaryFromHtml(html: string, max = 280): string {
  const $ = cheerio.load(html, null, false);
  $("table, .thumb, h1, h2, h3, h4, ul, ol, center").remove();
  const text = $("p")
    .map((_, p) => $(p).text().trim())
    .get()
    .find((t) => t.length > 80 && !/^not to be confused/i.test(t));
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

export function textFromHtml(html: string) {
  const $ = cheerio.load(html, null, false);
  return $.root().text().replace(/\s+/g, " ").trim();
}
