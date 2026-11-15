"use client";
import { Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { uploadToR2 } from "./upload";

export type PickedMedia = { id: number; filename: string; alt: string | null; url: string; path: string };

export function MediaPicker({ onPick, onClose }: { onPick: (m: PickedMedia) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickedMedia[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/media?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setItems(d.items ?? []))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Choose an image" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border p-3">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search images…" className="input" />
          <label className="btn-ghost cursor-pointer whitespace-nowrap">
            <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                setError("");
                try {
                  const { media, url } = await uploadToR2(f);
                  onPick({ id: media.id, filename: media.filename, alt: media.alt, url, path: `/media/${media.r2Key.split("/").map(encodeURIComponent).join("/")}` });
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          <button type="button" onClick={onClose} className="p-2 text-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="px-3 pt-2 text-sm text-danger">{error}</p>}
        <ul className="grid grid-cols-3 gap-2 overflow-y-auto p-3 sm:grid-cols-5">
          {items.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m)} className="flex w-full flex-col items-center gap-1 rounded-lg border border-border bg-bg-soft p-2 hover:border-accent-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="h-16 w-16 object-contain" loading="lazy" />
                <span className="line-clamp-2 break-all text-[10px] text-muted">{m.filename}</span>
              </button>
            </li>
          ))}
          {!items.length && <li className="col-span-full p-6 text-center text-sm text-muted">No images found.</li>}
        </ul>
      </div>
    </div>
  );
}
