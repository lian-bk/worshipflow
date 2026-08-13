// Creates the login for a brand-new church member and emails them an invite
// link through Resend — WorshipFlow controls the email content, not
// Supabase's own default template. Mirrors src/lib/resend.ts's "nice to
// have, not a requirement" pattern: if Resend isn't configured, the account
// still gets created and the link comes back so an Admin can copy/paste it
// themselves.
import "server-only";
import { createAdminClient } from "./supabase/admin";

const FALLBACK_APP_URL = "https://worshipflow-topaz.vercel.app";

export type InviteResult =
  | { success: true; userId: string; actionLink: string; emailSent: boolean; emailError?: string }
  | { error: string };

export async function inviteChurchMember(input: {
  email: string;
  churchName: string;
}): Promise<InviteResult> {
  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || FALLBACK_APP_URL;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: { redirectTo: `${appUrl}/invite/accept` },
  });

  if (error || !data.user) {
    const message = error?.message || "";
    if (message.toLowerCase().includes("already been registered")) {
      return { error: "That email already has a WorshipFlow account somewhere — ask them to log in instead." };
    }
    return { error: message || "Couldn't create an invite for that email." };
  }

  const actionLink = data.properties?.action_link;
  if (!actionLink) {
    return { error: "Couldn't build the invite link." };
  }

  const emailResult = await sendInviteEmail(input.email, actionLink, input.churchName);

  return {
    success: true,
    userId: data.user.id,
    actionLink,
    emailSent: !!emailResult.success,
    emailError: emailResult.error,
  };
}

async function sendInviteEmail(
  toEmail: string,
  actionLink: string,
  churchName: string
): Promise<{ success?: true; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "Email sending isn't set up yet (no RESEND_API_KEY) — copy the link and send it yourself for now." };
  }
  const from = process.env.RESEND_FROM_EMAIL || "WorshipFlow <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: toEmail,
        subject: `You've been invited to ${churchName} on WorshipFlow`,
        html: `
          <p>You've been invited to join <strong>${churchName}</strong> on WorshipFlow.</p>
          <p><a href="${actionLink}">Click here to set your password and get started</a></p>
          <p>If you weren't expecting this, you can safely ignore this email.</p>
        `,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Resend couldn't send the email: ${text}` };
    }
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send the invite email." };
  }
}
