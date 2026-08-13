"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteChurchMember } from "@/lib/invite";
import type { TeamRole } from "@/lib/supabase/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function requireChurch() {
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
  return { supabase, churchId: profile.church_id, isAdmin: profile.is_church_admin, userId: user.id };
}

// Admin can manage every team; a team's own Hotu/Bawmtu can manage only that
// one team. This mirrors the public.is_team_leader() check that also backs
// the RLS policies (0006_phase4_church_structure.sql) — checking here too
// just gets us a friendly error message instead of a raw database one.
async function assertCanManageTeam(supabase: ServerClient, teamId: string, isAdmin: boolean) {
  if (isAdmin) return;
  const { data: isLeader } = await supabase.rpc("is_team_leader", { p_team_id: teamId });
  if (!isLeader) {
    throw new Error("Only your church's Admin, or this team's own leaders, can do that.");
  }
}

// ---------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------

export async function createTeam(formData: FormData) {
  const { supabase, churchId, isAdmin } = await requireChurch();
  if (!isAdmin) throw new Error("Only your church's Admin can create teams.");
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Give the team a name.");

  const { error } = await supabase.from("teams").insert({ church_id: churchId, name });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/teams");
}

export async function renameTeam(teamId: string, formData: FormData) {
  const { supabase, isAdmin } = await requireChurch();
  if (!isAdmin) throw new Error("Only your church's Admin can rename teams.");
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Give the team a name.");

  const { error } = await supabase.from("teams").update({ name }).eq("id", teamId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/teams");
  revalidatePath(`/dashboard/teams/${teamId}`);
}

export async function deleteTeam(teamId: string) {
  const { supabase, isAdmin } = await requireChurch();
  if (!isAdmin) throw new Error("Only your church's Admin can delete teams.");
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/teams");
  redirect("/dashboard/teams");
}

// ---------------------------------------------------------------------
// Team membership
// ---------------------------------------------------------------------

export async function addExistingPersonToTeam(teamId: string, personId: string, role: TeamRole) {
  const { supabase, isAdmin } = await requireChurch();
  await assertCanManageTeam(supabase, teamId, isAdmin);

  const { error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: personId, role });
  if (error) {
    if (error.code === "23505") throw new Error("That person is already on this team.");
    throw new Error(error.message);
  }
  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath("/dashboard/people");
}

// Some volunteers genuinely have no email — this creates them as a name-only
// row (account_status 'no_login') that can be rostered like anyone else, but
// can never sign in.
export async function addNoLoginPersonToTeam(teamId: string, name: string, role: TeamRole) {
  const { supabase, churchId, isAdmin } = await requireChurch();
  await assertCanManageTeam(supabase, teamId, isAdmin);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give this person a name.");

  // Uses the service-role client on purpose: there's no RLS insert policy
  // for creating another person's row (nobody should be able to do that
  // without a check), so permission is enforced above via
  // assertCanManageTeam instead, same as the invite flow below.
  const admin = createAdminClient();
  const { data: person, error } = await admin
    .from("users")
    .insert({ church_id: churchId, full_name: trimmed, account_status: "no_login" })
    .select("id")
    .single();
  if (error || !person) throw new Error(error?.message || "Couldn't add that person.");

  const { error: memberError } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: person.id, role });
  if (memberError) throw new Error(memberError.message);

  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath("/dashboard/people");
}

export async function inviteNewPersonToTeam(
  teamId: string,
  email: string,
  role: TeamRole
): Promise<{ warning?: string }> {
  const { supabase, churchId, isAdmin } = await requireChurch();
  await assertCanManageTeam(supabase, teamId, isAdmin);
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) throw new Error("Enter an email address.");

  const { data: church } = await supabase.from("churches").select("name").eq("id", churchId).single();

  const result = await inviteChurchMember({
    email: trimmedEmail,
    churchName: church?.name || "your church",
  });
  if ("error" in result) throw new Error(result.error);

  // The auth account exists now (inviteChurchMember created it) — this adds
  // the matching public.users row. Service-role client because the invited
  // person isn't the one making this request, so the "own row" RLS rule
  // doesn't apply yet.
  const admin = createAdminClient();
  const { error: personError } = await admin.from("users").insert({
    id: result.userId,
    auth_user_id: result.userId,
    church_id: churchId,
    email: trimmedEmail,
    account_status: "invited",
  });
  if (personError) throw new Error(personError.message);

  const { error: memberError } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: result.userId, role });
  if (memberError) throw new Error(memberError.message);

  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath("/dashboard/people");

  if (!result.emailSent) {
    return {
      warning: `${
        result.emailError || "Couldn't send the invite email."
      } Share this link with them yourself: ${result.actionLink}`,
    };
  }
  return {};
}

export async function updateMemberRole(teamId: string, memberRowId: string, role: TeamRole) {
  const { supabase, isAdmin } = await requireChurch();
  await assertCanManageTeam(supabase, teamId, isAdmin);
  const { error } = await supabase.from("team_members").update({ role }).eq("id", memberRowId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath("/dashboard/people");
}

export async function removeMember(teamId: string, memberRowId: string) {
  const { supabase, isAdmin } = await requireChurch();
  await assertCanManageTeam(supabase, teamId, isAdmin);
  const { error } = await supabase.from("team_members").delete().eq("id", memberRowId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath("/dashboard/people");
}
