import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createRosterMonth, duplicateLastMonth } from "../actions";
import { DeleteRosterButton } from "./delete-roster-button";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function TeamRosterHubPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("church_id, is_church_admin").eq("id", user.id).single()
    : { data: null };
  if (!profile?.church_id) notFound();

  const { data: team } = await supabase.from("teams").select("id, name").eq("id", teamId).single();
  if (!team) notFound();

  const [{ data: isLeaderData }, { data: rosters }] = await Promise.all([
    profile.is_church_admin
      ? Promise.resolve({ data: true })
      : supabase.rpc("is_team_leader", { p_team_id: teamId }),
    supabase
      .from("rosters")
      .select("id, month, year, status")
      .eq("team_id", teamId)
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
  ]);
  const canManage = profile.is_church_admin || !!isLeaderData;

  const now = new Date();
  const defaultMonth = now.getMonth() + 1;
  const defaultYear = now.getFullYear();

  return (
    <div>
      <p className="mb-2">
        <Link href="/dashboard/roster" className="text-sm text-slate-500 underline">
          ← All teams
        </Link>
      </p>
      <h1 className="text-2xl font-semibold text-slate-900">{team.name} — Roster</h1>

      {canManage && (
        <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <form action={createRosterMonth.bind(null, teamId)} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Month</span>
              <select
                name="month"
                defaultValue={defaultMonth}
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Year</span>
              <input
                type="number"
                name="year"
                defaultValue={defaultYear}
                className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              New Month
            </button>
          </form>

          {rosters && rosters.length > 0 && (
            <form action={duplicateLastMonth.bind(null, teamId)}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Duplicate last month
              </button>
            </form>
          )}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {!rosters || rosters.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            No rosters yet{canManage ? " — start one with “New Month” above." : "."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rosters.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                <Link href={`/dashboard/roster/${teamId}/${r.id}`} className="flex flex-1 items-center gap-3">
                  <span className="font-medium text-slate-900">
                    {MONTH_NAMES[r.month - 1]} {r.year}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                      r.status === "published"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {r.status === "published" ? "Published" : "Draft"}
                  </span>
                </Link>
                {canManage && (
                  <DeleteRosterButton rosterId={r.id} label={`${MONTH_NAMES[r.month - 1]} ${r.year}`} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
