"use server";

import { createClient } from "@/lib/supabase/server";

// Called right after the invited person sets their password on the client.
// By this point the browser Supabase client has already stored their new
// session in cookies, so the regular (RLS-bound) server client can see who
// they are — this just flips their own row from "invited" to "active".
export async function activateInvitedAccount(fullName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const updates: { account_status: "active"; full_name?: string } = { account_status: "active" };
  const trimmed = fullName.trim();
  if (trimmed) updates.full_name = trimmed;

  const { error } = await supabase.from("users").update(updates).eq("auth_user_id", user.id);
  if (error) throw new Error(error.message);
}
