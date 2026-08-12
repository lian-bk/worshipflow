"use client";

import { useState, useTransition } from "react";
import { revokeKey, extendKey, resendKeyEmail } from "./actions";

export function ChurchRowActions({
  keyId,
  status,
  planCode,
}: {
  keyId: string;
  status: "unused" | "active" | "expired" | "revoked";
  planCode: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleRevoke() {
    if (!window.confirm("Revoke this church's access? They'll be locked out immediately.")) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      await revokeKey(keyId);
    });
  }

  function handleExtend(extension: "30" | "365" | "lifetime") {
    setMessage(null);
    startTransition(async () => {
      await extendKey(keyId, extension);
    });
  }

  function handleResend() {
    setMessage(null);
    startTransition(async () => {
      const result = await resendKeyEmail(keyId);
      setMessage(result?.error ? result.error : "Email sent.");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        <button
          type="button"
          onClick={() => handleExtend("30")}
          disabled={pending}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          +30 days
        </button>
        <button
          type="button"
          onClick={() => handleExtend("365")}
          disabled={pending}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          +365 days
        </button>
        {planCode !== "lifetime" && (
          <button
            type="button"
            onClick={() => handleExtend("lifetime")}
            disabled={pending}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Make Lifetime
          </button>
        )}
        <button
          type="button"
          onClick={handleResend}
          disabled={pending}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Resend Email
        </button>
        {status !== "revoked" && (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={pending}
            className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Revoke
          </button>
        )}
      </div>
      {message && <p className="text-xs text-slate-500">{message}</p>}
    </div>
  );
}
