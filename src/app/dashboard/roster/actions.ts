"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRosterPublishedEmail } from "@/lib/resend";
import type { AssignmentResponse } from "@/lib/supabase/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

async function requireChurch() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase
    .from("users")
    .select("id, church_id, is_church_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.church_id) throw new Error("No church on this account.");
  return { supabase, churchId: profile.church_id, isAdmin: profile.is_church_admin, userId: profile.id };
}

// Admin can manage every team's roster; a team's own Hotu/Bawmtu can manage
// only that one team's roster. Mirrors assertCanManageTeam in
// teams/actions.ts and the same public.is_team_leader() RLS check.
async function assertCanManageRoster(supabase: ServerClient, teamId: string, isAdmin: boolean) {
  if (isAdmin) return;
  const { data: isLeader } = await supabase.rpc("is_team_leader", { p_team_id: teamId });
  if (!isLeader) {
    throw new Error("Only your church's Admin, or this team's own leaders, can manage its roster.");
  }
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthBounds(month: number, year: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return { start: isoDate(year, month, 1), end: isoDate(year, month, daysInMonth), daysInMonth };
}

// Makes sure every weekly-pattern service type has an occurrence row for
// each matching weekday in this month. Uses the service-role client on
// purpose — the caller has already been permission-checked via
// assertCanManageRoster, and a Hotu (not just the Admin) needs to be able
// to trigger this even though service_occurrences' service_type_id branch
// is otherwise Admin-only (it's shared, church-wide data; the Service Types
// page is where an Admin curates it, but "New Month" just fills in the
// dates that pattern already implies). Special multi-date events ('dates'
// pattern) are untouched here — their occurrences are added by hand on the
// Service Types page and simply get picked up if they fall in this month.
async function ensureWeeklyOccurrences(churchId: string, month: number, year: number) {
  const admin = createAdminClient();
  const { data: serviceTypes } = await admin
    .from("service_types")
    .select("id, pattern_type, default_weekday")
    .eq("church_id", churchId);

  const weekly = (serviceTypes ?? []).filter(
    (st) => st.pattern_type === "weekly" && st.default_weekday !== null
  );
  if (weekly.length === 0) return;

  const { daysInMonth } = monthBounds(month, year);
  const rows: { service_type_id: string; date: string }[] = [];
  for (const st of weekly) {
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      if (d.getDay() === st.default_weekday) {
        rows.push({ service_type_id: st.id, date: isoDate(year, month, day) });
      }
    }
  }
  if (rows.length === 0) return;

  await admin
    .from("service_occurrences")
    .upsert(rows, { onConflict: "service_type_id,date", ignoreDuplicates: true });
}

async function ensureRoster(supabase: ServerClient, teamId: string, month: number, year: number) {
  const { data: existing } = await supabase
    .from("rosters")
    .select("id")
    .eq("team_id", teamId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("rosters")
    .insert({ team_id: teamId, month, year })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: fallback } = await supabase
        .from("rosters")
        .select("id")
        .eq("team_id", teamId)
        .eq("month", month)
        .eq("year", year)
        .single();
      if (fallback) return fallback.id;
    }
    throw new Error(error.message);
  }
  return created.id;
}

// ---------------------------------------------------------------------
// "New Month"
// ---------------------------------------------------------------------

export async function createRosterMonth(teamId: string, formData: FormData) {
  const { supabase, churchId, isAdmin } = await requireChurch();
  await assertCanManageRoster(supabase, teamId, isAdmin);

  const month = Number(formData.get("month"));
  const year = Number(formData.get("year"));
  if (!month || month < 1 || month > 12) throw new Error("Pick a month.");
  if (!year || year < 2000) throw new Error("Pick a year.");

  await ensureWeeklyOccurrences(churchId, month, year);
  const rosterId = await ensureRoster(supabase, teamId, month, year);

  revalidatePath(`/dashboard/roster/${teamId}`);
  redirect(`/dashboard/roster/${teamId}/${rosterId}`);
}

// ---------------------------------------------------------------------
// "Duplicate last month" — copies the most recent existing roster's
// assignments into the next month, matched by ordinal position within
// each weekly service type (the actual calendar dates shift, so "the 1st
// Sunday's LEADER" carries over rather than an exact date). Roster-only
// extra dates and per-date notes are deliberately NOT copied — they rarely
// recur unchanged, so it's safer to leave them for the Hotu to re-add.
// ---------------------------------------------------------------------

export async function duplicateLastMonth(teamId: string) {
  const { supabase, churchId, isAdmin } = await requireChurch();
  await assertCanManageRoster(supabase, teamId, isAdmin);

  const { data: rosters } = await supabase
    .from("rosters")
    .select("id, month, year")
    .eq("team_id", teamId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1);
  const source = rosters?.[0];
  if (!source) throw new Error("There's no previous roster to duplicate yet.");

  const targetMonth = source.month === 12 ? 1 : source.month + 1;
  const targetYear = source.month === 12 ? source.year + 1 : source.year;

  await ensureWeeklyOccurrences(churchId, targetMonth, targetYear);
  const targetRosterId = await ensureRoster(supabase, teamId, targetMonth, targetYear);

  const [{ data: sourceOccurrences }, { data: targetOccurrences }, { data: sourceAssignments }] =
    await Promise.all([
      supabase
        .from("service_occurrences")
        .select("id, service_type_id, date")
        .not("service_type_id", "is", null)
        .gte("date", monthBounds(source.month, source.year).start)
        .lte("date", monthBounds(source.month, source.year).end)
        .order("date"),
      supabase
        .from("service_occurrences")
        .select("id, service_type_id, date")
        .not("service_type_id", "is", null)
        .gte("date", monthBounds(targetMonth, targetYear).start)
        .lte("date", monthBounds(targetMonth, targetYear).end)
        .order("date"),
      supabase
        .from("roster_assignments")
        .select("service_occurrence_id, team_position_id, user_id")
        .eq("roster_id", source.id),
    ]);

  if (!sourceAssignments || sourceAssignments.length === 0) {
    revalidatePath(`/dashboard/roster/${teamId}`);
    redirect(`/dashboard/roster/${teamId}/${targetRosterId}`);
  }

  // Ordinal position (1st, 2nd, 3rd... occurrence of a given service type
  // within the month) is the mapping key between source and target month.
  function ordinalsByServiceType(occurrences: { id: string; service_type_id: string | null; date: string }[]) {
    const byType = new Map<string, string[]>();
    for (const occ of occurrences) {
      if (!occ.service_type_id) continue;
      if (!byType.has(occ.service_type_id)) byType.set(occ.service_type_id, []);
      byType.get(occ.service_type_id)!.push(occ.id);
    }
    // occurrences were already ordered by date, so index = ordinal
    const occIdToOrdinal = new Map<string, { serviceTypeId: string; ordinal: number }>();
    for (const [serviceTypeId, ids] of byType) {
      ids.forEach((id, ordinal) => occIdToOrdinal.set(id, { serviceTypeId, ordinal }));
    }
    return occIdToOrdinal;
  }

  const sourceMap = ordinalsByServiceType(sourceOccurrences ?? []);

  // Target ordinal map (occurrences already ordered by date), so "the 1st
  // Sunday's LEADER" carries over to whichever date is the 1st Sunday next
  // month, even if the exact day-of-month shifted.
  const targetOrdinalIndex = new Map<string, string[]>();
  for (const occ of targetOccurrences ?? []) {
    if (!occ.service_type_id) continue;
    if (!targetOrdinalIndex.has(occ.service_type_id)) targetOrdinalIndex.set(occ.service_type_id, []);
    targetOrdinalIndex.get(occ.service_type_id)!.push(occ.id);
  }

  const newRows: { roster_id: string; service_occurrence_id: string; team_position_id: string; user_id: string }[] = [];
  for (const a of sourceAssignments ?? []) {
    const mapping = sourceMap.get(a.service_occurrence_id);
    if (!mapping || !a.user_id) continue;
    const targetIds = targetOrdinalIndex.get(mapping.serviceTypeId);
    const targetOccurrenceId = targetIds?.[mapping.ordinal];
    if (!targetOccurrenceId) continue;
    newRows.push({
      roster_id: targetRosterId,
      service_occurrence_id: targetOccurrenceId,
      team_position_id: a.team_position_id,
      user_id: a.user_id,
    });
  }

  if (newRows.length > 0) {
    await supabase
      .from("roster_assignments")
      .upsert(newRows, { onConflict: "roster_id,service_occurrence_id,team_position_id" });
  }

  revalidatePath(`/dashboard/roster/${teamId}`);
  redirect(`/dashboard/roster/${teamId}/${targetRosterId}`);
}

// ---------------------------------------------------------------------
// Cell assignment
// ---------------------------------------------------------------------

async function rosterTeamId(supabase: ServerClient, rosterId: string) {
  const { data } = await supabase.from("rosters").select("team_id").eq("id", rosterId).single();
  if (!data) throw new Error("Roster not found.");
  return data.team_id;
}

export async function assignPerson(
  rosterId: string,
  occurrenceId: string,
  positionId: string,
  personId: string | null
) {
  const { supabase, isAdmin } = await requireChurch();
  const teamId = await rosterTeamId(supabase, rosterId);
  await assertCanManageRoster(supabase, teamId, isAdmin);

  if (!personId) {
    const { error } = await supabase
      .from("roster_assignments")
      .delete()
      .eq("roster_id", rosterId)
      .eq("service_occurrence_id", occurrenceId)
      .eq("team_position_id", positionId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("roster_assignments").upsert(
      {
        roster_id: rosterId,
        service_occurrence_id: occurrenceId,
        team_position_id: positionId,
        user_id: personId,
        response: "pending",
      },
      { onConflict: "roster_id,service_occurrence_id,team_position_id" }
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/dashboard/roster/${teamId}/${rosterId}`);
}

// Checked before saving a cell — returns other teams' assignments for this
// person on the same calendar date, so the UI can warn (not block) per the
// spec: "Mai Lal Ruat Kim is already on the Projector roster for 16 Aug."
export type RosterConflict = { teamName: string; positionLabel: string; dateLabel: string };

export async function checkConflicts(
  personId: string,
  occurrenceId: string,
  currentTeamId: string
): Promise<RosterConflict[]> {
  const { supabase } = await requireChurch();

  const { data: occurrence } = await supabase
    .from("service_occurrences")
    .select("date")
    .eq("id", occurrenceId)
    .single();
  if (!occurrence) return [];

  const { data: sameDateOccurrences } = await supabase
    .from("service_occurrences")
    .select("id")
    .eq("date", occurrence.date);
  const occurrenceIds = (sameDateOccurrences ?? []).map((o) => o.id);
  if (occurrenceIds.length === 0) return [];

  const { data: assignments } = await supabase
    .from("roster_assignments")
    .select("roster_id, team_position_id, service_occurrence_id")
    .in("service_occurrence_id", occurrenceIds)
    .eq("user_id", personId);
  if (!assignments || assignments.length === 0) return [];

  const rosterIds = [...new Set(assignments.map((a) => a.roster_id))];
  const { data: rosters } = await supabase.from("rosters").select("id, team_id").in("id", rosterIds);
  const otherTeamRosterIds = new Set(
    (rosters ?? []).filter((r) => r.team_id !== currentTeamId).map((r) => r.id)
  );
  const relevant = assignments.filter((a) => otherTeamRosterIds.has(a.roster_id));
  if (relevant.length === 0) return [];

  const teamIdByRoster = new Map((rosters ?? []).map((r) => [r.id, r.team_id]));
  const teamIds = [...new Set(relevant.map((a) => teamIdByRoster.get(a.roster_id)!))];
  const positionIds = [...new Set(relevant.map((a) => a.team_position_id))];

  const [{ data: teams }, { data: positions }] = await Promise.all([
    supabase.from("teams").select("id, name").in("id", teamIds),
    supabase.from("team_positions").select("id, label").in("id", positionIds),
  ]);
  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const positionLabelById = new Map((positions ?? []).map((p) => [p.id, p.label]));

  const dateLabel = new Date(occurrence.date + "T00:00:00").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

  return relevant.map((a) => ({
    teamName: teamNameById.get(teamIdByRoster.get(a.roster_id)!) || "another team",
    positionLabel: positionLabelById.get(a.team_position_id) || "a position",
    dateLabel,
  }));
}

// ---------------------------------------------------------------------
// Per-date notes — shared occurrence.note stays Admin-only/global (set on
// the Service Types page); this is each team's own private annotation on
// that date within their own roster. A roster-only extra date (added via
// addExtraDate below) has no shared note to protect, so its own `note`
// column is used directly instead.
// ---------------------------------------------------------------------

export async function setNote(rosterId: string, occurrenceId: string, note: string) {
  const { supabase, isAdmin } = await requireChurch();
  const teamId = await rosterTeamId(supabase, rosterId);
  await assertCanManageRoster(supabase, teamId, isAdmin);

  const { data: occurrence } = await supabase
    .from("service_occurrences")
    .select("id, roster_id")
    .eq("id", occurrenceId)
    .single();
  if (!occurrence) throw new Error("Date not found.");

  const trimmed = note.trim();

  if (occurrence.roster_id) {
    const { error } = await supabase
      .from("service_occurrences")
      .update({ note: trimmed || null })
      .eq("id", occurrenceId);
    if (error) throw new Error(error.message);
  } else if (trimmed) {
    const { error } = await supabase
      .from("roster_notes")
      .upsert(
        { roster_id: rosterId, service_occurrence_id: occurrenceId, note: trimmed },
        { onConflict: "roster_id,service_occurrence_id" }
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("roster_notes")
      .delete()
      .eq("roster_id", rosterId)
      .eq("service_occurrence_id", occurrenceId);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/dashboard/roster/${teamId}/${rosterId}`);
}

// ---------------------------------------------------------------------
// Extra, one-off dates that aren't part of any weekly pattern (e.g. a
// five-night crusade) — private to this roster/team.
// ---------------------------------------------------------------------

export async function addExtraDate(rosterId: string, date: string, note: string) {
  const { supabase, isAdmin } = await requireChurch();
  const teamId = await rosterTeamId(supabase, rosterId);
  await assertCanManageRoster(supabase, teamId, isAdmin);
  if (!date) throw new Error("Pick a date.");

  const { error } = await supabase
    .from("service_occurrences")
    .insert({ roster_id: rosterId, date, note: note.trim() || null });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/roster/${teamId}/${rosterId}`);
}

export async function removeExtraDate(rosterId: string, occurrenceId: string) {
  const { supabase, isAdmin } = await requireChurch();
  const teamId = await rosterTeamId(supabase, rosterId);
  await assertCanManageRoster(supabase, teamId, isAdmin);

  const { error } = await supabase
    .from("service_occurrences")
    .delete()
    .eq("id", occurrenceId)
    .eq("roster_id", rosterId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/roster/${teamId}/${rosterId}`);
}

// ---------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------

export async function publishRoster(rosterId: string) {
  const { supabase, isAdmin } = await requireChurch();
  const teamId = await rosterTeamId(supabase, rosterId);
  await assertCanManageRoster(supabase, teamId, isAdmin);

  const [{ data: roster }, { data: team }] = await Promise.all([
    supabase.from("rosters").select("id, month, year").eq("id", rosterId).single(),
    supabase.from("teams").select("name").eq("id", teamId).single(),
  ]);
  if (!roster) throw new Error("Roster not found.");

  const { error } = await supabase.from("rosters").update({ status: "published" }).eq("id", rosterId);
  if (error) throw new Error(error.message);

  const { data: assignments } = await supabase
    .from("roster_assignments")
    .select("user_id")
    .eq("roster_id", rosterId)
    .not("user_id", "is", null);
  const userIds = [...new Set((assignments ?? []).map((a) => a.user_id).filter((id): id is string => !!id))];

  let emailsSent = 0;
  let emailsFailed = 0;
  if (userIds.length > 0) {
    const { data: people } = await supabase.from("users").select("id, email").in("id", userIds);
    const monthLabel = `${MONTH_NAMES[roster.month - 1]} ${roster.year}`;
    const results = await Promise.all(
      (people ?? [])
        .filter((p) => !!p.email)
        .map((p) => sendRosterPublishedEmail(p.email as string, team?.name || "Your team", monthLabel))
    );
    for (const r of results) {
      if (r.success) emailsSent++;
      else emailsFailed++;
    }
  }

  revalidatePath(`/dashboard/roster/${teamId}/${rosterId}`);
  revalidatePath("/dashboard/my-schedule");
  return { emailsSent, emailsFailed };
}

export async function unpublishRoster(rosterId: string) {
  const { supabase, isAdmin } = await requireChurch();
  const teamId = await rosterTeamId(supabase, rosterId);
  await assertCanManageRoster(supabase, teamId, isAdmin);

  const { error } = await supabase.from("rosters").update({ status: "draft" }).eq("id", rosterId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/roster/${teamId}/${rosterId}`);
  revalidatePath("/dashboard/my-schedule");
}

// ---------------------------------------------------------------------
// My Schedule — accept/decline
// ---------------------------------------------------------------------

export async function respondToAssignment(assignmentId: string, response: AssignmentResponse) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.rpc("respond_to_assignment", {
    p_assignment_id: assignmentId,
    p_response: response,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/my-schedule");
}
