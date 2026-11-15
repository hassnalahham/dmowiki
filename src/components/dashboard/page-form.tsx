"use client";
import { useActionState } from "react";
import { savePage, type ActionState } from "@/app/dashboard/actions";
import { RichEditor } from "./rich-editor";

type Initial = { id?: number; title: string; slug: string; type: string; html: string; categories: string; published: boolean };

export function PageForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(savePage, undefined);
  return (
    <form action={action} className="space-y-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="label" htmlFor="title">
            Title
          </label>
          <input id="title" name="title" defaultValue={initial.title} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="type">
            Type
          </label>
          <select id="type" name="type" defaultValue={initial.type} className="input">
            {["article", "item", "map", "quest", "patch", "digimon"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="slug">
            URL slug (optional)
          </label>
          <input id="slug" name="slug" defaultValue={initial.slug} placeholder="Derived from the title" className="input" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="published" defaultChecked={initial.published} className="h-4 w-4 accent-[var(--accent)]" />{" "}
            Published
          </label>
        </div>
        <div className="md:col-span-3">
          <label className="label" htmlFor="categories">
            Categories (comma separated)
          </label>
          <input id="categories" name="categories" defaultValue={initial.categories} className="input" />
        </div>
      </div>
      <div>
        <span className="label">Content</span>
        <RichEditor name="html" initialHtml={initial.html} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input name="comment" placeholder="Edit summary (optional)" className="input max-w-md" aria-label="Edit summary" />
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.error && (
          <span role="alert" className="text-sm text-danger">
            {state.error}
          </span>
        )}
        {state?.ok && (
          <span role="status" className="text-sm text-ok">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
