"use client";

import { useActionState, useState, useTransition } from "react";
import { generateKey, resendKeyEmail, type GenerateKeyState } from "./actions";

type Plan = {
  plan_code: string;
  label: string;
};

const initialState: GenerateKeyState = {};

export function GenerateKeyForm({ plans }: { plans: Plan[] }) {
  const [state, formAction, pending] = useActionState(generateKey, initialState);
  const [copied, setCopied] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  function handleCopy() {
    if (!state.keyCode) return;
    navigator.clipboard.writeText(state.keyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSendEmail() {
    if (!state.keyId) return;
    setEmailStatus(null);
    startSending(async () => {
      const result = await resendKeyEmail(state.keyId!);
      if (result?.error) {
        setEmailStatus(result.error);
      } else {
        setEmailStatus("Email sent.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-base font-semibold text-slate-900">Generate a Key</h2>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="planCode" className="text-xs font-medium text-slate-600">
            Plan
          </label>
          <select
            id="planCode"
            name="planCode"
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {plans.map((plan) => (
              <option key={plan.plan_code} value={plan.plan_code}>
                {plan.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-xs font-medium text-slate-600">
            Church contact&apos;s email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="pastor@church.org"
            className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate"}
        </button>
      </form>

      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}

      {state.keyCode && (
        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-600">New key:</p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-slate-900">
            {state.keyCode}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={sending}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send by Email"}
            </button>
            {emailStatus && <span className="text-sm text-slate-600">{emailStatus}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
