/** Placeholder prefix for media stored in R2; resolved to the public bucket URL at render time. */
export const MEDIA_PREFIX = "/media/";

export function mediaPath(filename: string) {
  return `${MEDIA_PREFIX}wiki/${encodeURIComponent(filename.replace(/ /g, "_"))}`;
}

/** Swap `/media/<key>` placeholders for the public R2 URL. */
export function resolveMediaUrls(html: string, publicBase = process.env.R2_PUBLIC_URL ?? "") {
  if (!publicBase) return html;
  return html.replace(/(["'(])\/media\//g, `$1${publicBase}/`);
}
