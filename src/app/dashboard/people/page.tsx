import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  invited: "Invite pending",
  no_login: "No login",
};

export default async function PeoplePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("church_id, is_church_admin").eq("id", user.id).single()
    : { data: null };

  if (!profile?.is_church_admin || !profile.church_id) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">People</h1>
        <p className="mt-2 text-sm text-slate-500">
          Only your church&rsquo;s Admin can see the full people directory.
        </p>
      </div>
    );
  }

  const [{ data: people }, { data: teams }, { data: memberRows }, { data: church }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, account_status")
      .eq("church_id", profile.church_id)
      .order("full_name"),
    supabase.from("teams").select("id, name"),
    supabase.from("team_members").select("team_id, user_id, role"),
    supabase.from("churches").select("hotu_label, bawmtu_label").eq("id", profile.church_id).single(),
  ]);

  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const roleLabel = (role: string) =>
    role === "hotu" ? church?.hotu_label || "Hotu" : role === "bawmtu" ? church?.bawmtu_label || "Bawmtu" : "Member";

  const teamsByPerson = new Map<string, { teamId: string; teamName: string; role: string }[]>();
  for (const row of memberRows ?? []) {
    const list = teamsByPerson.get(row.user_id) ?? [];
    list.push({ teamId: row.team_id, teamName: teamNameById.get(row.team_id) || "Team", role: row.role });
    teamsByPerson.set(row.user_id, list);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">People</h1>
        <p className="mt-1 text-sm text-slate-500">
          Everyone in your church, and every team they belong to. Invite or add people from a
          team&rsquo;s own page.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {!people || people.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">No one yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {people.map((person) => (
              <li key={person.id} className="px-5 py-3">
                <Link
                  href={`/dashboard/people/${person.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {person.full_name || person.email || "Unnamed"}
                </Link>
                <p className="text-xs text-slate-400">
                  {person.email || "No email"} · {STATUS_LABEL[person.account_status] || person.account_status}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(teamsByPerson.get(person.id) ?? []).map((t) => (
                    <Link
                      key={t.teamId}
                      href={`/dashboard/teams/${t.teamId}`}
                      className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      {t.teamName} ({roleLabel(t.role)})
                    </Link>
                  ))}
                  {(teamsByPerson.get(person.id) ?? []).length === 0 && (
                    <span className="text-xs text-slate-300">No teams yet</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
