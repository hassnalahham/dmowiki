"use client";

export type UploadedMedia = { id: number; filename: string; r2Key: string; alt: string | null };

function dimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return Promise.resolve({});
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({});
    img.src = URL.createObjectURL(file);
  });
}

/** Presign -> PUT straight to R2 -> register in the media table. */
export async function uploadToR2(file: File, opts: { replaceId?: number; alt?: string } = {}) {
  const pre = await fetch("/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, replaceId: opts.replaceId }),
  });
  const p = await pre.json();
  if (!pre.ok) throw new Error(p.error ?? "Upload failed");
  const put = await fetch(p.url, { method: "PUT", body: file, headers: { "content-type": file.type } });
  if (!put.ok) throw new Error(`R2 rejected the upload (${put.status}). Check the bucket CORS settings.`);
  const dims = await dimensions(file);
  const conf = await fetch("/api/upload", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: p.key, filename: file.name, contentType: file.type, size: file.size, alt: opts.alt, ...dims }),
  });
  const c = await conf.json();
  if (!conf.ok) throw new Error(c.error ?? "Upload failed");
  return { media: c.media as UploadedMedia, url: c.url as string };
}
