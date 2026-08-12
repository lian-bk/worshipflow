"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateKeyCode } from "@/lib/license-keys";
import { sendKeyEmail } from "@/lib/resend";
import { expireOverdueKeys } from "@/lib/expire-keys";

// Every action re-checks is_owner itself, on top of the /owner layout's own
// check and the database's RLS policies — three separate locks on the same
// door, so a mistake in any one layer still isn't enough to expose this.
async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase
    .from("users")
    .select("is_owner")
    .eq("id", user.id)
    .single();

  if (!profile?.is_owner) throw new Error("Not authorized.");
  return supabase;
}

export type GenerateKeyState = {
  error?: string;
  keyCode?: string;
  keyId?: string;
};

export async function generateKey(
  _prev: GenerateKeyState,
  formData: FormData
): Promise<GenerateKeyState> {
  try {
    const supabase = await requireOwner();
    const planCode = String(formData.get("planCode") || "");
    const email = String(formData.get("email") || "").trim();

    if (!planCode || !email) {
      return { error: "Pick a plan and enter the church contact's email." };
    }

    const keyCode = generateKeyCode();
    const { data, error } = await supabase
      .from("license_keys")
      .insert({
        key_code: keyCode,
        plan_code: planCode,
        issued_to_email: email,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    revalidatePath("/owner");
    return { keyCode, keyId: data.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function revokeKey(keyId: string) {
  const supabase = await requireOwner();
  await supabase.from("license_keys").update({ status: "revoked" }).eq("id", keyId);
  revalidatePath("/owner");
}

export async function extendKey(keyId: string, extension: "30" | "365" | "lifetime") {
  const supabase = await requireOwner();

  if (extension === "lifetime") {
    await supabase
      .from("license_keys")
      .update({ status: "active", plan_code: "lifetime", expires_at: null })
      .eq("id", keyId);
  } else {
    const days = extension === "30" ? 30 : 365;
    const { data: key } = await supabase
      .from("license_keys")
      .select("expires_at")
      .eq("id", keyId)
      .single();

    // Extend from whichever is later: the key's current expiry (if it
    // hasn't happened yet) or right now (if it already expired/was
    // revoked) — so extending a lapsed key gives a full fresh period
    // instead of quietly leaving it still-expired.
    const currentExpiry = key?.expires_at ? new Date(key.expires_at) : null;
    const base = currentExpiry && currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
    const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    await supabase
      .from("license_keys")
      .update({ status: "active", expires_at: newExpiry.toISOString() })
      .eq("id", keyId);
  }

  revalidatePath("/owner");
}

export async function resendKeyEmail(keyId: string) {
  await requireOwner();
  const supabase = await createClient();
  const { data: key } = await supabase
    .from("license_keys")
    .select("key_code, issued_to_email")
    .eq("id", keyId)
    .single();

  if (!key) return { error: "Key not found." };
  return sendKeyEmail(key.issued_to_email, key.key_code);
}

export async function runExpirationCheckNow() {
  await requireOwner();
  const count = await expireOverdueKeys();
  revalidatePath("/owner");
  return count;
}
