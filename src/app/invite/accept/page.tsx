"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { activateInvitedAccount } from "./actions";

// Landed on after clicking the invite link from the email. The Supabase
// browser client automatically reads the access/refresh tokens out of the
// URL (it's built to do this) and turns them into a real signed-in session
// — we just wait for that to happen, then ask for a password.
export default function AcceptInvitePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"waiting" | "ready" | "expired" | "saving" | "done">("waiting");
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setEmail(data.session.user.email ?? null);
        setStatus("ready");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setEmail(session.user.email ?? null);
        setStatus("ready");
      }
    });

    const timeout = setTimeout(() => {
      setStatus((current) => (current === "waiting" ? "expired" : current));
    }, 4000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      return;
    }

    try {
      await activateInvitedAccount(fullName);
    } catch {
      // Non-fatal — the password is already set, so they can still get in.
    }

    setStatus("done");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Join WorshipFlow</h1>

        {status === "waiting" && (
          <p className="mt-4 text-sm text-slate-500">Checking your invite link…</p>
        )}

        {status === "expired" && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-red-600">
              This invite link isn&rsquo;t valid anymore — it may have already been used or
              expired.
            </p>
            <p className="text-sm text-slate-500">
              Ask whoever invited you to send a new invite, or if you&rsquo;ve already set a
              password before, just{" "}
              <a href="/login" className="font-medium text-slate-900 underline">
                log in
              </a>
              .
            </p>
          </div>
        )}

        {(status === "ready" || status === "saving") && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {email && <p className="text-sm text-slate-500">Signing up as {email}</p>}

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Your name</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Set a password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Confirm password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "saving"}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {status === "saving" ? "Saving…" : "Set password & continue"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
