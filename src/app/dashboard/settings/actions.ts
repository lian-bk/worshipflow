"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TeamRole } from "@/lib/supabase/types";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase
    .from("users")
    .select("church_id, is_church_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.church_id) throw new Error("No church on this account.");
  if (!profile.is_church_admin) throw new Error("Only your church's Admin can change this.");
  return { supabase, churchId: profile.church_id };
}

// Lets a church rename the "Hotu"/"Bawmtu" role labels to whatever their
// team leaders are actually called — the underlying 'hotu'/'bawmtu' values
// used everywhere else in the database never change, only these display
// labels do.
export async function updateRoleLabels(formData: FormData) {
  const { supabase, churchId } = await requireAdmin();
  const hotuLabel = String(formData.get("hotu_label") || "").trim() || "Hotu";
  const bawmtuLabel = String(formData.get("bawmtu_label") || "").trim() || "Bawmtu";

  const { error } = await supabase
    .from("churches")
    .update({ hotu_label: hotuLabel, bawmtu_label: bawmtuLabel })
    .eq("id", churchId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/teams");
}

// ---------------------------------------------------------------------
// Testing tool: seeds the Praise & Worship sub-teams from the real
// spreadsheet you shared, so the Roster builder has real people (on
// multiple teams, with different roles on each) to test against — most
// usefully, people who serve on more than one team, which is what the
// roster conflict warning is for. Safe to click more than once: teams,
// positions, and people are matched by name first and only created if
// missing, so nothing gets duplicated on a second run.
// ---------------------------------------------------------------------

type SeedRole = TeamRole;
type SeedMember = { name: string; role: SeedRole };
type SeedTeam = { name: string; positions: string[]; members: SeedMember[] };

const SEED_TEAMS: SeedTeam[] = [
  {
    name: "Music Tumtu Pawl",
    positions: ["LEAD", "BASS", "DRUM", "AC", "PIANO"],
    members: [
      { name: "Pa David Siang Za Hmung", role: "hotu" },
      { name: "Pa Kyaw Naing", role: "bawmtu" },
      { name: "Pa Lal Cung Mang", role: "member" },
      { name: "Pa Myo Chit", role: "member" },
      { name: "Salai Steven Thuan Cung Nung", role: "member" },
      { name: "Salai Thian Bawm Thang", role: "member" },
      { name: "Salai Thian Lian Bawi", role: "member" },
      { name: "Salai Mang Uk Lal", role: "member" },
      { name: "Salai Ngo Khan Thang", role: "member" },
      { name: "Salai Zabi Van Hniang Lian", role: "member" },
      { name: "Salai David San Za Thang", role: "member" },
      { name: "Salai Thang Sin Lian", role: "member" },
      { name: "Salai Jerome Van Lian Hmui", role: "member" },
    ],
  },
  {
    name: "Hla Hruai Pawl",
    positions: ["LEADER", "BACKUP 1", "BACKUP 2", "BACKUP 3", "BACKUP 4"],
    members: [
      { name: "Salai Za Lian Dawl", role: "hotu" },
      { name: "Salai Nung Lian Tawng", role: "bawmtu" },
      { name: "Salai Daniel Thian Lian Sang", role: "member" },
      { name: "Salai Biak Ro Khum", role: "member" },
      { name: "Salai Thian Lawm Thang", role: "member" },
      { name: "Salai Joseph Van Nun Lian", role: "member" },
      { name: "Salai Cung Lian Piang", role: "member" },
      { name: "Salai Kap Lawn Thang", role: "member" },
      { name: "Mai Lal Ruat Kim", role: "member" },
      { name: "Mai Van Nun Thiang", role: "member" },
      { name: "Mai Rung Nei Tling", role: "member" },
      { name: "Mai Ella Zing Tha Men", role: "member" },
      { name: "Mai Elizabeth Khrih Nun Kim", role: "member" },
      { name: "Mai Tha Em Sin Kim", role: "member" },
      { name: "Mai Angella", role: "member" },
      { name: "Mai Hani Twe", role: "member" },
      { name: "Mai Sang Chin Par", role: "member" },
      { name: "Mai No Nei Thluai", role: "member" },
      { name: "Mai Thawm Len Thiam", role: "member" },
      { name: "Mai Nancy Tha Hlei Sung", role: "member" },
    ],
  },
  {
    name: "Sound System",
    positions: [],
    members: [
      { name: "Pa Cung Cin Lian", role: "hotu" },
      { name: "Pa Kyaw Naing", role: "bawmtu" },
      { name: "Pa Myo Chit", role: "member" },
      { name: "Pa David Siang Za Hmung", role: "member" },
      { name: "Pa Samuel Thang", role: "member" },
      { name: "Pa Mang Uk Lal", role: "member" },
      { name: "Pa Thian Lian Bawi", role: "member" },
    ],
  },
  {
    name: "Media",
    positions: [],
    members: [
      { name: "Pa Myo Chit", role: "hotu" },
      { name: "Salai Nung Lian Sang", role: "bawmtu" },
      { name: "Salai Cung Ro Sang", role: "member" },
      { name: "Salai Micheal Van Ro Sang", role: "member" },
      { name: "Salai David Sang Uk Lian", role: "member" },
      { name: "Salai Owen Thian Ro Sang", role: "member" },
      { name: "Salai Kap Nawn Thang", role: "member" },
      { name: "Salai Za Lian Dawl", role: "member" },
      { name: "Mai Elsie It Nei Kim", role: "member" },
      { name: "Mai Lal Ruat Kim", role: "member" },
      { name: "Mai No Nei Thluai", role: "member" },
    ],
  },
  {
    name: "Projector",
    positions: [],
    members: [
      { name: "Mai Dawt Hnem Mawi", role: "hotu" },
      { name: "Salai Lal Lian Kap", role: "bawmtu" },
      { name: "Salai Paul Thian Tuan Thang", role: "member" },
      { name: "Mai Lal Ruat Kim", role: "member" },
      { name: "Mai Elsie It Nei Kim", role: "member" },
      { name: "Mai Sophia Thian Nei Ang", role: "member" },
    ],
  },
];

// Strips the Pa/Salai/Mai honorific so "Salai Thian Lian Bawi" (Music team)
// and "Pa Thian Lian Bawi" (Sound System) are recognized as the same
// person instead of creating a duplicate — the whole point of this seed is
// to exercise the "same person, multiple teams" conflict-warning feature.
function normalizeName(name: string) {
  return name.replace(/^(Pa|Salai|Mai)\s+/i, "").trim().toLowerCase();
}

// Batched on purpose — an earlier version of this did one awaited round
// trip per team/position/person/membership (close to 150 for this data
// set), which was slow enough to blow past Vercel's serverless function
// timeout and fail with an opaque error. This version generates every id
// up front (same client-side-UUID trick importSongs uses in the Library
// module) so it only needs a handful of batched selects/inserts total,
// regardless of how many people are in the sheet.
export async function seedPraiseWorshipTeams() {
  const { supabase, churchId } = await requireAdmin();
  const admin = createAdminClient();

  // --- Teams: find existing, create missing, in one round trip each. ---
  const { data: existingTeams, error: teamsSelectErr } = await supabase
    .from("teams")
    .select("id, name")
    .eq("church_id", churchId)
    .in("name", SEED_TEAMS.map((t) => t.name));
  if (teamsSelectErr) throw new Error(teamsSelectErr.message);

  const teamIdByName = new Map((existingTeams ?? []).map((t) => [t.name, t.id]));
  const newTeamRows = SEED_TEAMS.filter((t) => !teamIdByName.has(t.name)).map((t) => ({
    id: randomUUID(),
    church_id: churchId,
    name: t.name,
  }));
  if (newTeamRows.length > 0) {
    const { error } = await supabase.from("teams").insert(newTeamRows);
    if (error) throw new Error(error.message);
    for (const row of newTeamRows) teamIdByName.set(row.name, row.id);
  }
  const teamsCreated = newTeamRows.length;

  const allTeamIds = SEED_TEAMS.map((t) => teamIdByName.get(t.name)!);

  // --- Roster columns: one select + one insert covering every team. ---
  const { data: existingPositions, error: positionsSelectErr } = await supabase
    .from("team_positions")
    .select("team_id, label")
    .in("team_id", allTeamIds);
  if (positionsSelectErr) throw new Error(positionsSelectErr.message);

  const existingPositionKeys = new Set((existingPositions ?? []).map((p) => `${p.team_id}:${p.label}`));
  const positionCountByTeam = new Map<string, number>();
  for (const p of existingPositions ?? []) {
    positionCountByTeam.set(p.team_id, (positionCountByTeam.get(p.team_id) ?? 0) + 1);
  }

  const newPositionRows: { team_id: string; label: string; display_order: number }[] = [];
  for (const teamDef of SEED_TEAMS) {
    const teamId = teamIdByName.get(teamDef.name)!;
    let order = positionCountByTeam.get(teamId) ?? 0;
    for (const label of teamDef.positions) {
      if (existingPositionKeys.has(`${teamId}:${label}`)) continue;
      newPositionRows.push({ team_id: teamId, label, display_order: order });
      order++;
    }
  }
  if (newPositionRows.length > 0) {
    const { error } = await supabase.from("team_positions").insert(newPositionRows);
    if (error) throw new Error(error.message);
  }

  // --- People: find existing (by name, ignoring the Pa/Salai/Mai title so
  // the same person on multiple teams is recognized once), create the rest
  // in a single bulk insert. ---
  const { data: existingPeople, error: peopleSelectErr } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("church_id", churchId);
  if (peopleSelectErr) throw new Error(peopleSelectErr.message);

  const personIdByKey = new Map<string, string>();
  for (const p of existingPeople ?? []) {
    if (p.full_name) personIdByKey.set(normalizeName(p.full_name), p.id);
  }

  const newPersonRows: { id: string; church_id: string; full_name: string; account_status: "no_login" }[] = [];
  for (const teamDef of SEED_TEAMS) {
    for (const m of teamDef.members) {
      const key = normalizeName(m.name);
      if (personIdByKey.has(key)) continue;
      const id = randomUUID();
      personIdByKey.set(key, id);
      newPersonRows.push({ id, church_id: churchId, full_name: m.name, account_status: "no_login" });
    }
  }
  if (newPersonRows.length > 0) {
    // Service-role client, same as addNoLoginPersonToTeam — there's no RLS
    // insert policy for creating another person's row on purpose; this
    // action already checked is_church_admin above.
    const { error } = await admin.from("users").insert(newPersonRows);
    if (error) throw new Error(error.message);
  }
  const peopleCreated = newPersonRows.length;

  // --- Team memberships: one select + one insert covering every team. ---
  const { data: existingMembers, error: membersSelectErr } = await supabase
    .from("team_members")
    .select("team_id, user_id")
    .in("team_id", allTeamIds);
  if (membersSelectErr) throw new Error(membersSelectErr.message);

  const existingMembershipKeys = new Set((existingMembers ?? []).map((m) => `${m.team_id}:${m.user_id}`));
  const newMembershipRows: { team_id: string; user_id: string; role: TeamRole }[] = [];
  for (const teamDef of SEED_TEAMS) {
    const teamId = teamIdByName.get(teamDef.name)!;
    for (const m of teamDef.members) {
      const personId = personIdByKey.get(normalizeName(m.name))!;
      const key = `${teamId}:${personId}`;
      if (existingMembershipKeys.has(key)) continue;
      existingMembershipKeys.add(key);
      newMembershipRows.push({ team_id: teamId, user_id: personId, role: m.role });
    }
  }
  if (newMembershipRows.length > 0) {
    const { error } = await supabase.from("team_members").insert(newMembershipRows);
    if (error) throw new Error(error.message);
  }
  const membershipsCreated = newMembershipRows.length;

  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard/people");
  revalidatePath("/dashboard/settings");
  return { teamsCreated, peopleCreated, membershipsCreated };
}
