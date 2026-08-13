// Sends the "here's your product key" email via Resend. If RESEND_API_KEY
// isn't set, this fails gracefully with a plain-English message instead of
// crashing — the Owner Console's Copy button still works either way, so
// email sending is a nice-to-have, not a requirement.
import "server-only";

const FALLBACK_APP_URL = "https://worshipflow-seven.vercel.app";

export async function sendKeyEmail(
  toEmail: string,
  keyCode: string
): Promise<{ success?: true; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      error:
        "Email sending isn't set up yet (no RESEND_API_KEY). Copy the key and send it yourself for now.",
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || FALLBACK_APP_URL;
  const registerUrl = `${appUrl}/register`;
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
        subject: "Your WorshipFlow product key",
        html: `
          <p>You've been given a WorshipFlow product key:</p>
          <p style="font-size:22px;font-weight:bold;letter-spacing:1px;">${keyCode}</p>
          <p>Register your church here: <a href="${registerUrl}">${registerUrl}</a></p>
        `,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Resend couldn't send the email: ${text}` };
    }
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send the email." };
  }
}

// Sent to every person with an assignment when a Hotu publishes a roster.
// Same graceful-degradation rule as the rest of this file: if Resend isn't
// configured, publishing still succeeds — people just won't get an email,
// only the in-app "My Schedule" page (which always works, no email needed).
export async function sendRosterPublishedEmail(
  toEmail: string,
  teamName: string,
  monthLabel: string
): Promise<{ success?: true; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "Email sending isn't set up yet (no RESEND_API_KEY)." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://worshipflow-topaz.vercel.app";
  const from = process.env.RESEND_FROM_EMAIL || "WorshipFlow <onboarding@resend.dev>";
  const scheduleUrl = `${appUrl}/dashboard/my-schedule`;

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
        subject: `${teamName} schedule for ${monthLabel} is ready`,
        html: `
          <p>The <strong>${teamName}</strong> schedule for <strong>${monthLabel}</strong> has been published.</p>
          <p><a href="${scheduleUrl}">View your schedule</a> to see what you're serving and accept or decline.</p>
        `,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Resend couldn't send the email: ${text}` };
    }
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send the email." };
  }
}
