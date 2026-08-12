"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { registerChurch, type RegisterState } from "./actions";

const initialState: RegisterState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
    >
      {pending ? "Registering…" : "Register Church"}
    </button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerChurch, initialState);

  if (state.success) {
    return (
      <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        {state.needsConfirmation ? (
          <>
            Your church is registered. Check <strong>your email</strong> for a
            confirmation link, then log in.
          </>
        ) : (
          <>
            Your church is registered and you&apos;re signed in. Go to{" "}
            <a href="/dashboard" className="font-medium underline">
              your dashboard
            </a>
            .
          </>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Field label="Product Key" name="productKey" placeholder="e.g. WFLW-TRIAL-XXXX" required />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Church Name" name="churchName" placeholder="Falam Church" required />
        <Field label="Language" name="languageCode" placeholder="en" defaultValue="en" />
      </div>

      <Field
        label="Church Contact Email"
        name="contactEmail"
        type="email"
        placeholder="church@example.com"
        required
      />

      <hr className="border-slate-200" />

      <Field label="Your Name" name="fullName" placeholder="Ti Thiang" required />
      <Field label="Your Login Email" name="email" type="email" placeholder="you@example.com" required />
      <Field
        label="Choose a Password"
        name="password"
        type="password"
        placeholder="At least 8 characters"
        required
        minLength={8}
      />

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  defaultValue,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        minLength={minLength}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
    </label>
  );
}
