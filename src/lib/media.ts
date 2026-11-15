import { mediaPath, resolveMediaUrls } from "./media-path";

/** Public URL for a wiki file name (served from R2, or via the /media fallback route). */
export function mediaUrl(filename: string) {
  const path = mediaPath(filename);
  const base = process.env.R2_PUBLIC_URL;
  return base ? `${base}${path.slice("/media".length)}` : path;
}

export function mediaUrlForKey(key: string) {
  const base = process.env.R2_PUBLIC_URL;
  const enc = key.split("/").map(encodeURIComponent).join("/");
  return base ? `${base}/${enc}` : `/media/${enc}`;
}

export function iconUrl(name: string) {
  return mediaUrl(`${name} Icon.png`);
}

export { resolveMediaUrls };
