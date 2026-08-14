"use server";

import { createClient } from "@/lib/supabase/server";
import { BLANK_PAYLOAD, type LivePayload } from "@/lib/live-show-types";

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
  if (!profile.is_church_admin) throw new Error("Only your church's Admin can run the live show.");
  return { supabase, churchId: profile.church_id };
}

// Get-or-create the shareable link token for this occurrence's live show.
// Same upsert-with-ignoreDuplicates idea used elsewhere in this app (see
// ensureWeeklyOccurrences in the Planner and Roster builders) so this is
// safe to call on every page load without creating duplicate rows or
// clobbering a token that's already been copied and shared out.
export async function ensureLiveLink(occurrenceId: string, churchName: string, tagline: string) {
  const { supabase, churchId } = await requireAdmin();

  const { data: existing } = await supabase
    .from("live_show_state")
    .select("token")
    .eq("occurrence_id", occurrenceId)
    .maybeSingle();
  if (existing?.token) return existing.token as string;

  await supabase.from("live_show_state").upsert(
    {
      occurrence_id: occurrenceId,
      church_id: churchId,
      church_name: churchName,
      tagline,
      payload: BLANK_PAYLOAD,
    },
    { onConflict: "occurrence_id", ignoreDuplicates: true }
  );

  const { data: row } = await supabase
    .from("live_show_state")
    .select("token")
    .eq("occurrence_id", occurrenceId)
    .single();
  return row!.token as string;
}

// Called every time the Admin changes what's live (next/previous slide,
// clear, logo). Persists the current state so Stage/Stream/Projector links
// opened mid-service immediately show the right thing, and (paired with a
// Realtime broadcast sent client-side) pushes the update instantly to
// anyone already watching a link.
export async function publishLiveState(occurrenceId: string, payload: LivePayload) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("live_show_state")
    .update({ payload, updated_at: new Date().toISOString() })
    .eq("occurrence_id", occurrenceId);
  if (error) throw new Error(error.message);
}
