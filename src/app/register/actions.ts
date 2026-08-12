"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegisterState = {
  error?: string;
  success?: boolean;
  needsConfirmation?: boolean;
};

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_KEY: "That product key doesn't exist. Double-check it and try again.",
  KEY_ALREADY_USED: "That product key has already been used to register a church.",
  KEY_EXPIRED: "That product key has expired. Contact the person who gave it to you for a new one.",
};

export async function registerChurch(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const productKey = String(formData.get("productKey") || "").trim();
  const churchName = String(formData.get("churchName") || "").trim();
  const contactEmail = String(formData.get("contactEmail") || "").trim();
  const languageCode = String(formData.get("languageCode") || "en").trim() || "en";
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!productKey || !churchName || !contactEmail || !fullName || !email || !password) {
    return { error: "Please fill in every field." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  // Step 1: create the person's login (Supabase Auth), using the normal
  // server client so this goes through the standard sign-up flow.
  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }
  const userId = signUpData.user?.id;
  if (!userId) {
    return { error: "Could not create your account. Please try again." };
  }

  // Step 2: redeem the product key and create the church, using the
  // service-role admin client so this works even before email confirmation
  // finishes, and so it can write to tables an ordinary user can't touch
  // directly (license_keys, users.is_church_admin).
  const admin = createAdminClient();
  const { data: redeemData, error: redeemError } = await admin.rpc("redeem_license_key", {
    p_key_code: productKey,
    p_church_name: churchName,
    p_contact_email: contactEmail,
    p_language_code: languageCode,
    p_user_id: userId,
    p_user_email: email,
    p_full_name: fullName,
  });

  if (redeemError) {
    // Something went wrong redeeming the key. Clean up the auth account we
    // just created so the person can try again with the same email instead
    // of being stuck with a half-registered account.
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    const code = redeemError.message as keyof typeof ERROR_MESSAGES;
    return { error: ERROR_MESSAGES[code] || redeemError.message };
  }

  void redeemData;

  return { success: true, needsConfirmation: !signUpData.session };
}
