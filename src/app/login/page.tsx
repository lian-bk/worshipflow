import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Log In</h1>
        <p className="mt-1 text-sm text-slate-500">Welcome back to WorshipFlow.</p>

        <LoginForm />

        <p className="mt-6 text-center text-sm text-slate-500">
          New church?{" "}
          <Link href="/register" className="font-medium text-slate-900 underline">
            Register with a product key
          </Link>
        </p>
      </div>
    </main>
  );
}
