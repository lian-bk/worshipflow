"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
