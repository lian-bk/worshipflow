import { createAdminClient } from "@/lib/supabase/admin";
import type { LivePayload } from "@/lib/live-show-types";

// Public link pages (Stage / Clean Stream / Projector) have no login, so
// they can't use the normal RLS-scoped server client — the token in the URL
// *is* the credential. This looks the row up with the service-role key
// (bypasses RLS on purpose) and only ever returns the small, already-public
// slide of data these pages need.
export async function lookupLiveState(token: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("live_show_state")
    .select("church_name, tagline, payload")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;

  return {
    churchName: data.church_name,
    tagline: data.tagline,
    payload: (data.payload ?? { type: "blank" }) as LivePayload,
  };
}
