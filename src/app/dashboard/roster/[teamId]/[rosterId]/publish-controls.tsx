"use client";

import { useState, useTransition } from "react";
import { publishRoster, unpublishRoster } from "../../actions";
import type { RosterStatus } from "@/lib/supabase/types";

export function PublishControls({ rosterId, status }: { rosterId: string; status: RosterStatus }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (status === "draft") {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                "Publish this roster? Everyone assigned will be emailed and see it on their My Schedule page."
              )
            )
              return;
            setMessage(null);
            startTransition(async () => {
              const result = await publishRoster(rosterId);
              setMessage(
                result.emailsSent > 0
                  ? `Published — ${result.emailsSent} email${result.emailsSent === 1 ? "" : "s"} sent.`
                  : "Published — no emails were sent (email isn't set up, or nobody has an email on file)."
              );
            });
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "Publishing…" : "Publish"}
        </button>
        {message && <span className="text-xs text-slate-500">{message}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Revert this roster to draft? It will disappear from everyone's My Schedule until you publish again.")) return;
          startTransition(() => unpublishRoster(rosterId));
        }}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Reverting…" : "Revert to Draft"}
      </button>
    </div>
  );
}
