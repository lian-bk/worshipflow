import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RosterGrid } from "./roster-grid";
import { PublishControls } from "./publish-controls";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default async function RosterGridPage({
  params,
}: {
  params: Promise<{ teamId: string; rosterId: string }>;
}) {
  const { teamId, rosterId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("church_id, is_church_admin").eq("id", user.id).single()
    : { data: null };
  if (!profile?.church_id) notFound();

  const { data: roster } = await supabase
    .from("rosters")
    .select("id, team_id, month, year, status")
    .eq("id", rosterId)
    .single();
  if (!roster || roster.team_id !== teamId) notFound();

  const { data: team } = await supabase.from("teams").select("id, name").eq("id", teamId).single();
  if (!team) notFound();

  const { data: isLeaderData } = profile.is_church_admin
    ? { data: true }
    : await supabase.rpc("is_team_leader", { p_team_id: teamId });
  const canManage = profile.is_church_admin || !!isLeaderData;

  const daysInMonth = new Date(roster.year, roster.month, 0).getDate();
  const monthStart = isoDate(roster.year, roster.month, 1);
  const monthEnd = isoDate(roster.year, roster.month, daysInMonth);

  const [{ data: positions }, { data: memberRows }, { data: serviceTypes }] = await Promise.all([
    supabase.from("team_positions").select("id, label, display_order").eq("team_id", teamId).order("display_order"),
    supabase.from("team_members").select("user_id").eq("team_id", teamId),
    supabase
      .from("service_types")
      .select("id, name, pattern_type, default_start_time, default_location")
      .eq("church_id", profile.church_id)
      .order("name"),
  ]);

  const memberUserIds = (memberRows ?? []).map((m) => m.user_id);
  const { data: memberPeople } = memberUserIds.length
    ? await supabase.from("users").select("id, full_name, email").in("id", memberUserIds)
    : { data: [] };
  const members = (memberPeople ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email || "Unnamed" }));

  const serviceTypeIds = (serviceTypes ?? []).map((st) => st.id);

  const [{ data: sharedOccurrences }, { data: extraOccurrences }, { data: rosterNotes }, { data: assignments }] =
    await Promise.all([
      serviceTypeIds.length
        ? supabase
            .from("service_occurrences")
            .select("id, service_type_id, date, note")
            .in("service_type_id", serviceTypeIds)
            .gte("date", monthStart)
            .lte("date", monthEnd)
            .order("date")
        : Promise.resolve({ data: [] }),
      supabase
        .from("service_occurrences")
        .select("id, date, note")
        .eq("roster_id", rosterId)
        .order("date"),
      supabase.from("roster_notes").select("service_occurrence_id, note").eq("roster_id", rosterId),
      supabase
        .from("roster_assignments")
        .select("id, service_occurrence_id, team_position_id, user_id, response")
        .eq("roster_id", rosterId),
    ]);

  const serviceTypeById = new Map((serviceTypes ?? []).map((st) => [st.id, st]));
  const sectionsMap = new Map<
    string,
    { serviceTypeId: string; serviceTypeName: string; occurrences: { id: string; date: string; note: string | null }[] }
  >();
  for (const occ of sharedOccurrences ?? []) {
    if (!occ.service_type_id) continue;
    const st = serviceTypeById.get(occ.service_type_id);
    if (!st) continue;
    if (!sectionsMap.has(st.id)) sectionsMap.set(st.id, { serviceTypeId: st.id, serviceTypeName: st.name, occurrences: [] });
    sectionsMap.get(st.id)!.occurrences.push({ id: occ.id, date: occ.date, note: occ.note });
  }
  const sections = [...sectionsMap.values()].sort((a, b) => a.serviceTypeName.localeCompare(b.serviceTypeName));

  const notesByOccurrence: Record<string, string> = {};
  for (const n of rosterNotes ?? []) notesByOccurrence[n.service_occurrence_id] = n.note;

  const assignmentByCell: Record<string, { userId: string; response: string }> = {};
  for (const a of assignments ?? []) {
    if (!a.user_id) continue;
    assignmentByCell[`${a.service_occurrence_id}:${a.team_position_id}`] = { userId: a.user_id, response: a.response };
  }

  return (
    <div>
      <p className="mb-2">
        <Link href={`/dashboard/roster/${teamId}`} className="text-sm text-slate-500 underline">
          ← {team.name} rosters
        </Link>
      </p>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {team.name} — {MONTH_NAMES[roster.month - 1]} {roster.year}
          </h1>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              roster.status === "published"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-300 bg-slate-50 text-slate-600"
            }`}
          >
            {roster.status === "published" ? "Published" : "Draft"}
          </span>
        </div>
        {canManage && <PublishControls rosterId={rosterId} status={roster.status} />}
      </div>

      {(positions ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          This team has no roster columns yet — add some on the team&rsquo;s page first (e.g. LEADER, BACKUP 1).
        </p>
      ) : (
        <RosterGrid
          rosterId={rosterId}
          teamId={teamId}
          canManage={canManage}
          positions={positions ?? []}
          members={members}
          sections={sections}
          extraDates={(extraOccurrences ?? []).map((o) => ({ id: o.id, date: o.date, note: o.note }))}
          notesByOccurrence={notesByOccurrence}
          assignmentByCell={assignmentByCell}
        />
      )}
    </div>
  );
}
