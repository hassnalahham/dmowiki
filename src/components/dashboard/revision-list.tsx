"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { restoreRevision } from "@/app/dashboard/actions";

type Rev = { id: number; comment: string | null; user: string | null; createdAt: string | Date };

export function RevisionList({ revisions }: { revisions: Rev[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!revisions.length)
    return <p className="text-sm text-muted">No revisions yet. Imported content gets its first revision when edited.</p>;
  return (
    <ul className="divide-y divide-border text-sm">
      {revisions.map((r, i) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0">
            <span className="block truncate">{r.comment ?? "Edit"}</span>
            <span className="text-xs text-muted">
              {r.user ?? "unknown"} · {new Date(r.createdAt).toLocaleString("en-GB")}
            </span>
          </span>
          {i > 0 && (
            <button
              type="button"
              className="btn-ghost shrink-0 text-xs"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await restoreRevision(r.id);
                  router.refresh();
                })
              }
            >
              Restore
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
