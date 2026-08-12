"use client";

import { useState, useTransition } from "react";
import { runExpirationCheckNow } from "./actions";

// This exists so Ti can test the "daily expiration check" without waiting
// for the real once-a-day schedule to fire — it runs the exact same code
// the Vercel Cron job runs, just on demand.
export function RunExpirationButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const count = await runExpirationCheckNow();
      setMessage(
        count === 0
          ? "Checked — no overdue keys to expire."
          : `Expired ${count} overdue key${count === 1 ? "" : "s"}.`
      );
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Checking…" : "Run Expiration Check Now"}
      </button>
      {message && <span className="text-sm text-slate-600">{message}</span>}
    </div>
  );
}
