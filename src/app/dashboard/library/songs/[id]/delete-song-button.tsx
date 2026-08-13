"use client";

import { useTransition } from "react";
import { deleteSong } from "../../actions";

export function DeleteSongButton({ songId }: { songId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm("Delete this entire song, including its slides and arrangements?")) return;
        startTransition(() => {
          deleteSong(songId);
        });
      }}
      disabled={pending}
      className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      Delete Song
    </button>
  );
}
