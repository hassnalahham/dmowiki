/** MediaWiki-style title <-> slug helpers. Slugs keep the wiki convention (spaces -> underscores). */

export function titleToSlug(title: string) {
  const t = title.trim().replace(/\s+/g, "_");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function slugToTitle(slug: string) {
  return decodeURIComponent(slug).replace(/_/g, " ");
}

export function wikiHref(title: string) {
  return `/wiki/${encodeURIComponent(titleToSlug(title)).replace(/%2F/g, "/")}`;
}

export function categoryHref(name: string) {
  return `/category/${encodeURIComponent(titleToSlug(name))}`;
}
