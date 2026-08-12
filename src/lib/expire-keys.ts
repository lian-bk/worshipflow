// The actual "mark overdue keys as expired" logic — called by both the
// daily Vercel Cron job (src/app/api/cron/expire-keys/route.ts) and the
// Owner Console's "Run Expiration Check Now" button, so testing doesn't
// require waiting for the real schedule.
import "server-only";
import { createAdminClient } from "./supabase/admin";

export async function expireOverdueKeys(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("license_keys")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}
