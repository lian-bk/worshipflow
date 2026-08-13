import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { renameTeam } from "../actions";
import { TeamManage } from "./team-manage";
import { DeleteTeamButton } from "./delete-team-button";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("church_id, is_church_admin").eq("id", user.id).single()
    : { data: null };
  if (!profile?.church_id) notFound();

  const { data: team } = await supabase.from("teams").select("id, name").eq("id", id).single();
  if (!team) notFound();

  const [{ data: church }, { data: memberRows }, { data: isLeaderData }] = await Promise.all([
    supabase.from("churches").select("hotu_label, bawmtu_label").eq("id", profile.church_id).single(),
    supabase.from("team_members").select("id, user_id, role").eq("team_id", id),
    profile.is_church_admin
      ? Promise.resolve({ data: true })
      : supabase.rpc("is_team_leader", { p_team_id: id }),
  ]);

  const canManage = profile.is_church_admin || !!isLeaderData;

  const memberUserIds = (memberRows ?? []).map((m) => m.user_id);
  const [{ data: memberPeople }, { data: allPeople }] = await Promise.all([
    memberUserIds.length > 0
      ? supabase
          .from("users")
          .select("id, full_name, email, account_status")
          .in("id", memberUserIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("users")
      .select("id, full_name, email")
      .eq("church_id", profile.church_id)
      .order("full_name"),
  ]);

  const peopleById = new Map((memberPeople ?? []).map((p) => [p.id, p]));
  const members = (memberRows ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    personId: m.user_id,
    name: peopleById.get(m.user_id)?.full_name || peopleById.get(m.user_id)?.email || "Unnamed",
    email: peopleById.get(m.user_id)?.email ?? null,
    accountStatus: peopleById.get(m.user_id)?.account_status ?? "active",
  }));

  const availablePeople = (allPeople ?? [])
    .filter((p) => !memberUserIds.includes(p.id))
    .map((p) => ({ id: p.id, name: p.full_name || p.email || "Unnamed" }));

  return (
    <div>
      <p className="mb-2">
        <Link href="/dashboard/teams" className="text-sm text-slate-500 underline">
          ← All teams
        </Link>
      </p>

      <div className="mb-6 flex items-start justify-between gap-4">
        {profile.is_church_admin ? (
          <form action={renameTeam.bind(null, team.id)} className="flex items-center gap-2">
            <input
              name="name"
              defaultValue={team.name}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xl font-semibold text-slate-900"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Save
            </button>
          </form>
        ) : (
          <h1 className="text-2xl font-semibold text-slate-900">{team.name}</h1>
        )}

        {profile.is_church_admin && <DeleteTeamButton teamId={team.id} />}
      </div>

      <TeamManage
        teamId={team.id}
        canManage={canManage}
        members={members}
        availablePeople={availablePeople}
        hotuLabel={church?.hotu_label || "Hotu"}
        bawmtuLabel={church?.bawmtu_label || "Bawmtu"}
      />
    </div>
  );
}
