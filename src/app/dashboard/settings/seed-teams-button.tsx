"use client";

import { useState, useTransition } from "react";
import { seedPraiseWorshipTeams } from "./actions";

// One-time testing helper: creates the 5 Praise & Worship sub-teams (Music
// Tumtu Pawl, Hla Hruai Pawl, Sound System, Media, Projector) with their
// real members and roles, so there's real data to build a roster against —
// including several people who serve on more than one team, which is what
// makes the conflict warning testable. Safe to click more than once.
export function SeedTeamsButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ teamsCreated: number; peopleCreated: number; membershipsCreated: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-6 max-w-md rounded-xl border border-dashed border-slate-300 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Testing tools</h2>
      <p className="mt-1 text-sm text-slate-500">
        Creates the 5 Praise &amp; Worship sub-teams (Music Tumtu Pawl, Hla Hruai Pawl, Sound
        System, Media, Projector) with their real members, so there&rsquo;s data to build a
        roster against. Safe to click more than once — it won&rsquo;t create duplicates.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setResult(null);
          startTransition(async () => {
            try {
              const outcome = await seedPraiseWorshipTeams();
              if ("error" in outcome) {
                setError(outcome.error);
              } else {
                setResult(outcome);
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : "Something went wrong.");
            }
          });
        }}
        className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import sample Praise & Worship teams"}
      </button>
      {result && (
        <p className="mt-2 text-xs text-emerald-700">
          Done — {result.teamsCreated} team{result.teamsCreated === 1 ? "" : "s"} added,{" "}
          {result.peopleCreated} new {result.peopleCreated === 1 ? "person" : "people"}, {result.membershipsCreated} team
          membership{result.membershipsCreated === 1 ? "" : "s"} added.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
