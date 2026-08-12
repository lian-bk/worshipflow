import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center">
      <h1 className="text-3xl font-semibold text-slate-900">WorshipFlow</h1>
      <p className="max-w-md text-slate-500">
        Church presentation and team scheduling, built for your own church&apos;s
        structure.
      </p>
      <div className="flex gap-3">
        <Link
          href="/register"
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Register Your Church
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-white"
        >
          Log In
        </Link>
      </div>
    </main>
  );
}
