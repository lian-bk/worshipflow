// Used by the dashboard shell to decide whether to lock a church out. Goes
// through the admin client on purpose: license_keys stays owner-only under
// Row Level Security (per Phase 1 — "only I can see licensing data"), so an
// ordinary church user's own session can't read it directly. This function
// is the one narrow, server-only exception that checks just enough to
// decide "locked or not," without ever exposing the raw license_keys row
// to the browser.
import "server-only";
import { createAdminClient } from "./supabase/admin";
import { isKeyLocked, daysRemaining } from "./license-keys";

export type ChurchLicenseInfo = {
  status: "unused" | "active" | "expired" | "revoked";
  planCode: string;
  expiresAt: string | null;
  locked: boolean;
  isTrial: boolean;
  daysRemaining: number | null;
};

export async function getChurchLicenseInfo(churchId: string): Promise<ChurchLicenseInfo | null> {
  const admin = createAdminClient();

  const { data: church } = await admin
    .from("churches")
    .select("license_key_id")
    .eq("id", churchId)
    .single();

  if (!church?.license_key_id) return null;

  const { data: key } = await admin
    .from("license_keys")
    .select("status, plan_code, expires_at")
    .eq("id", church.license_key_id)
    .single();

  if (!key) return null;

  return {
    status: key.status,
    planCode: key.plan_code,
    expiresAt: key.expires_at,
    locked: isKeyLocked(key),
    isTrial: key.plan_code === "trial_14",
    daysRemaining: daysRemaining(key.expires_at),
  };
}

// Powers the lockout screen's "contact [my email] to renew" line. Reads the
// live Owner account instead of hard-coding an address, so it stays correct
// even if Ti ever changes which account is marked as Owner. Falls back to a
// fixed address only if, for some reason, no Owner row exists yet.
export async function getOwnerContactEmail(): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("email")
    .eq("is_owner", true)
    .limit(1)
    .maybeSingle();

  return data?.email ?? "the app owner";
}
