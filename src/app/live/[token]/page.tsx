import Link from "next/link";
import { notFound } from "next/navigation";
import { lookupLiveState } from "./lookup";

// Fallback if someone opens the base link without /stage, /stream, or
// /projector on the end — points them to the right one instead of a dead page.
export default async function LiveLandingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await lookupLiveState(token);
  if (!state) notFound();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-white">
      <h1 className="text-xl font-semibold">{state.churchName}</h1>
      <p className="text-sm text-slate-400">Choose the output you meant to open:</p>
      <div className="flex flex-col gap-2">
        <Link href={`/live/${token}/stage`} className="rounded-lg bg-slate-800 px-4 py-2 hover:bg-slate-700">
          Stage Display
        </Link>
        <Link href={`/live/${token}/stream`} className="rounded-lg bg-slate-800 px-4 py-2 hover:bg-slate-700">
          Clean Stream
        </Link>
        <Link href={`/live/${token}/projector`} className="rounded-lg bg-slate-800 px-4 py-2 hover:bg-slate-700">
          Projector
        </Link>
      </div>
    </div>
  );
}
