import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createTeam } from "./actions";

export default async function TeamsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("is_church_admin").eq("id", user.id).single()
    : { data: null };
  const isAdmin = profile?.is_church_admin ?? false;

  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase.from("teams").select("id, name, created_at").order("display_order").order("name"),
    supabase.from("team_members").select("team_id"),
  ]);

  const countByTeam = new Map<string, number>();
  for (const m of members ?? []) {
    countByTeam.set(m.team_id, (countByTeam.get(m.team_id) ?? 0) + 1);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Teams</h1>
        <p className="mt-1 text-sm text-slate-500">
          Build your church&rsquo;s own team structure — name teams however you like, in your
          own language.
        </p>
      </div>

      <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {!teams || teams.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            No teams yet.{" "}
            {isAdmin ? "Create your first one below." : "Ask your church's Admin to create one."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {teams.map((team) => (
              <li key={team.id}>
                <Link
                  href={`/dashboard/teams/${team.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{team.name}</span>
                  <span className="text-xs text-slate-400">
                    {countByTeam.get(team.id) ?? 0} member
                    {(countByTeam.get(team.id) ?? 0) === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAdmin && (
        <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">New team</h2>
          <form action={createTeam} className="flex flex-col gap-3">
            <input
              name="name"
              required
              placeholder="e.g. Music Tumtu Pawl, Sound System, Media…"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Create Team
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
