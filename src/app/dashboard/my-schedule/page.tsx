import { createClient } from "@/lib/supabase/server";
import { ScheduleList, type ScheduleItem } from "./schedule-list";

export default async function MySchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("id").eq("id", user.id).single()
    : { data: null };

  if (!profile) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Schedule</h1>
      </div>
    );
  }

  const { data: assignments } = await supabase
    .from("roster_assignments")
    .select("id, roster_id, service_occurrence_id, team_position_id, response")
    .eq("user_id", profile.id);

  let items: ScheduleItem[] = [];

  if (assignments && assignments.length > 0) {
    const rosterIds = [...new Set(assignments.map((a) => a.roster_id))];
    const { data: rosters } = await supabase
      .from("rosters")
      .select("id, team_id, status")
      .in("id", rosterIds);
    const publishedRosterIds = new Set((rosters ?? []).filter((r) => r.status === "published").map((r) => r.id));
    const teamIdByRoster = new Map((rosters ?? []).map((r) => [r.id, r.team_id]));

    const published = assignments.filter((a) => publishedRosterIds.has(a.roster_id));

    if (published.length > 0) {
      const occurrenceIds = [...new Set(published.map((a) => a.service_occurrence_id))];
      const positionIds = [...new Set(published.map((a) => a.team_position_id))];
      const teamIds = [...new Set(published.map((a) => teamIdByRoster.get(a.roster_id)!))];

      const [{ data: occurrences }, { data: positions }, { data: teams }] = await Promise.all([
        supabase.from("service_occurrences").select("id, service_type_id, date, note").in("id", occurrenceIds),
        supabase.from("team_positions").select("id, label").in("id", positionIds),
        supabase.from("teams").select("id, name").in("id", teamIds),
      ]);

      const serviceTypeIds = [...new Set((occurrences ?? []).map((o) => o.service_type_id).filter((id): id is string => !!id))];
      const { data: serviceTypes } = serviceTypeIds.length
        ? await supabase
            .from("service_types")
            .select("id, name, default_start_time, default_location")
            .in("id", serviceTypeIds)
        : { data: [] };

      const occurrenceById = new Map((occurrences ?? []).map((o) => [o.id, o]));
      const positionById = new Map((positions ?? []).map((p) => [p.id, p]));
      const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
      const serviceTypeById = new Map((serviceTypes ?? []).map((st) => [st.id, st]));

      items = published
        .map((a): ScheduleItem | null => {
          const occ = occurrenceById.get(a.service_occurrence_id);
          const position = positionById.get(a.team_position_id);
          const team = teamById.get(teamIdByRoster.get(a.roster_id)!);
          if (!occ || !position || !team) return null;
          const st = occ.service_type_id ? serviceTypeById.get(occ.service_type_id) : null;
          return {
            assignmentId: a.id,
            teamName: team.name,
            positionLabel: position.label,
            serviceTypeName: st?.name ?? null,
            date: occ.date,
            startTime: st?.default_start_time ?? null,
            location: st?.default_location ?? null,
            note: occ.note,
            response: a.response,
          };
        })
        .filter((x): x is ScheduleItem => x !== null)
        .sort((a, b) => a.date.localeCompare(b.date));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">My Schedule</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Every date you&rsquo;re serving, across every team you&rsquo;re on.
      </p>
      <ScheduleList items={items} />
    </div>
  );
}
