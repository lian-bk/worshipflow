import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  invited: "Invite pending",
  no_login: "No login (rostered by name only)",
};

export default async function PersonProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
        <h1 className="text-2xl font-semibold text-slate-900">Person</h1>
        <p className="mt-2 text-sm text-slate-500">
          Only your church&rsquo;s Admin can view people&rsquo;s profiles.
        </p>
      </div>
    );
  }

  const { data: person } = await supabase
    .from("users")
    .select("id, full_name, email, account_status, church_id")
    .eq("id", id)
    .single();
  if (!person || person.church_id !== profile.church_id) notFound();

  const [{ data: church }, { data: memberRows }] = await Promise.all([
    supabase.from("churches").select("hotu_label, bawmtu_label").eq("id", profile.church_id).single(),
    supabase.from("team_members").select("team_id, role").eq("user_id", id),
  ]);

  const teamIds = (memberRows ?? []).map((m) => m.team_id);
  const { data: teams } =
    teamIds.length > 0
      ? await supabase.from("teams").select("id, name").in("id", teamIds)
      : { data: [] };
  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));

  const roleLabel = (role: string) =>
    role === "hotu" ? church?.hotu_label || "Hotu" : role === "bawmtu" ? church?.bawmtu_label || "Bawmtu" : "Member";

  return (
    <div>
      <p className="mb-2">
        <Link href="/dashboard/people" className="text-sm text-slate-500 underline">
          ← All people
        </Link>
      </p>

      <h1 className="text-2xl font-semibold text-slate-900">{person.full_name || person.email || "Unnamed"}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {person.email || "No email on file"} ·{" "}
        {STATUS_LABEL[person.account_status] || person.account_status}
      </p>

      <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Teams
      </h2>
      {(memberRows ?? []).length === 0 ? (
        <p className="text-sm text-slate-400">Not on any team yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {(memberRows ?? []).map((m) => (
            <li key={m.team_id}>
              <Link
                href={`/dashboard/teams/${m.team_id}`}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                {teamNameById.get(m.team_id) || "Team"} — {roleLabel(m.role)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
