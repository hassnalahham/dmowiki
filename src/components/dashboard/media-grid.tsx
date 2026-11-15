"use client";
import { Copy, RefreshCw, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMedia, updateMediaAlt } from "@/app/dashboard/actions";
import { uploadToR2 } from "./upload";

type Item = { id: number; filename: string; alt: string | null; url: string; path: string; size: number | null; width: number | null; height: number | null };

export function MediaGrid({ items, isAdmin }: { items: Item[]; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);
  const [pending, start] = useTransition();

  const upload = async (files: FileList | File[], replaceId?: number) => {
    setError("");
    const list = [...files];
    for (const [i, f] of list.entries()) {
      setBusy(`Uploading ${i + 1}/${list.length}: ${f.name}`);
      try {
        await uploadToR2(f, { replaceId });
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
        break;
      }
    }
    setBusy("");
    router.refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-3">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm ${
            drag ? "border-accent bg-accent/5" : "border-border text-muted"
          }`}
        >
          <Upload className="h-5 w-5" />
          {busy || "Drop images here or click to upload to R2"}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={!!busy} onChange={(e) => e.target.files && upload(e.target.files)} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setSelected(m)}
                className={`flex w-full flex-col items-center gap-1 rounded-lg border bg-panel p-2 ${selected?.id === m.id ? "border-accent" : "border-border hover:border-accent-2"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt ?? ""} loading="lazy" className="h-16 w-16 object-contain" />
                <span className="line-clamp-2 break-all text-[10px] text-muted">{m.filename}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <aside className="card h-fit space-y-3 p-4 lg:sticky lg:top-4">
        {selected ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.url} alt={selected.alt ?? ""} className="mx-auto max-h-48 object-contain" />
            <div className="break-all text-sm font-medium">{selected.filename}</div>
            <div className="text-xs text-muted">
              {selected.width && selected.height ? `${selected.width}×${selected.height} · ` : ""}
              {selected.size ? `${(selected.size / 1024).toFixed(1)} KB` : ""}
            </div>
            <label className="block">
              <span className="label">Alt text</span>
              <input
                key={selected.id}
                defaultValue={selected.alt ?? ""}
                className="input"
                onBlur={(e) => {
                  const alt = e.target.value;
                  start(async () => {
                    await updateMediaAlt(selected.id, alt);
                    router.refresh();
                  });
                }}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost text-xs" onClick={() => navigator.clipboard.writeText(selected.path)}>
                <Copy className="h-3.5 w-3.5" /> Copy path
              </button>
              <label className="btn-ghost cursor-pointer text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Replace
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload([e.target.files[0]], selected.id)} />
              </label>
              {isAdmin && (
                <button
                  type="button"
                  className="btn-ghost text-xs text-danger"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Delete ${selected.filename} from R2? Pages using it will show a broken image.`)) return;
                    start(async () => {
                      const r = await deleteMedia(selected.id);
                      if (r?.error) setError(r.error);
                      setSelected(null);
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
            </div>
            <p className="text-xs text-muted">Replacing keeps the same URL, so every page using this image updates.</p>
          </>
        ) : (
          <p className="text-sm text-muted">Select an image to see details.</p>
        )}
      </aside>
    </div>
  );
}
