"use client";
import { useTransition } from "react";
import { deletePage } from "@/app/dashboard/actions";

export function DeletePageButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-danger w-full"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this page permanently (including Digimon data and history)?")) start(() => deletePage(id));
      }}
    >
      {pending ? "Deleting…" : "Delete page"}
    </button>
  );
}
