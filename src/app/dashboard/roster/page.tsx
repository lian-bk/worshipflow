import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function RosterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("id, church_id").eq("id", user.id).single()
    : { data: null };

  const teams = profile?.church_id
    ? (await supabase.from("teams").select("id, name").eq("church_id", profile.church_id).order("name")).data
    : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Roster</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Pick a team to build or view its monthly roster.
      </p>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {!teams || teams.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            No teams yet — create one on the Teams page first.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {teams.map((team) => (
              <li key={team.id}>
                <Link
                  href={`/dashboard/roster/${team.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{team.name}</span>
                  <span className="text-slate-400">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
