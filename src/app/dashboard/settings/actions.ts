"use server";

import { revalidatePath } from "next/cache";
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

export async function seedPraiseWorshipTeams() {
  const { supabase, churchId } = await requireAdmin();
  const admin = createAdminClient();

  const { data: existingPeople } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("church_id", churchId);
  const personIdByKey = new Map<string, string>();
  for (const p of existingPeople ?? []) {
    if (p.full_name) personIdByKey.set(normalizeName(p.full_name), p.id);
  }

  let teamsCreated = 0;
  let peopleCreated = 0;
  let membershipsCreated = 0;

  async function getOrCreatePerson(fullName: string) {
    const key = normalizeName(fullName);
    const existing = personIdByKey.get(key);
    if (existing) return existing;

    const { data: created, error } = await admin
      .from("users")
      .insert({ church_id: churchId, full_name: fullName, account_status: "no_login" })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message || `Couldn't create ${fullName}.`);
    personIdByKey.set(key, created.id);
    peopleCreated++;
    return created.id;
  }

  for (const teamDef of SEED_TEAMS) {
    const { data: existingTeam } = await supabase
      .from("teams")
      .select("id")
      .eq("church_id", churchId)
      .eq("name", teamDef.name)
      .maybeSingle();

    let teamId: string;
    if (existingTeam) {
      teamId = existingTeam.id;
    } else {
      const { data: created, error } = await supabase
        .from("teams")
        .insert({ church_id: churchId, name: teamDef.name })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message || `Couldn't create team "${teamDef.name}".`);
      teamId = created.id;
      teamsCreated++;
    }

    if (teamDef.positions.length > 0) {
      const { data: existingPositions } = await supabase
        .from("team_positions")
        .select("label")
        .eq("team_id", teamId);
      const existingLabels = new Set((existingPositions ?? []).map((p) => p.label));
      const toInsert = teamDef.positions
        .filter((label) => !existingLabels.has(label))
        .map((label, idx) => ({ team_id: teamId, label, display_order: existingLabels.size + idx }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from("team_positions").insert(toInsert);
        if (error) throw new Error(error.message);
      }
    }

    const { data: existingMembers } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId);
    const existingMemberIds = new Set((existingMembers ?? []).map((m) => m.user_id));

    for (const m of teamDef.members) {
      const personId = await getOrCreatePerson(m.name);
      if (existingMemberIds.has(personId)) continue;

      const { error } = await supabase
        .from("team_members")
        .insert({ team_id: teamId, user_id: personId, role: m.role });
      if (error && error.code !== "23505") throw new Error(error.message);
      existingMemberIds.add(personId);
      membershipsCreated++;
    }
  }

  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard/people");
  revalidatePath("/dashboard/settings");
  return { teamsCreated, peopleCreated, membershipsCreated };
}
