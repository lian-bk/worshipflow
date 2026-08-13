"use client";

import { useTransition } from "react";
import { deleteRoster } from "../actions";

export function DeleteRosterButton({ rosterId, label }: { rosterId: string; label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(`Delete the ${label} roster? This removes its dates and assignments too.`))
          return;
        startTransition(() => {
          deleteRoster(rosterId);
        });
      }}
      disabled={pending}
      className="shrink-0 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
