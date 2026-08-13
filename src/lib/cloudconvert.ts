// Talks to CloudConvert to turn an uploaded PowerPoint file into one image per
// slide. If CLOUDCONVERT_API_KEY isn't set, this fails gracefully — the media
// row for the .pptx is still created and saved, it just stays in "pending"
// (no slide images) until the key is added later. Same "nice to have, not a
// requirement" pattern as src/lib/resend.ts for email.
import "server-only";
import { createAdminClient } from "./supabase/admin";

const CLOUDCONVERT_API = "https://api.cloudconvert.com/v2";

export async function startPptxConversion(input: {
  mediaId: string;
  storagePath: string;
}): Promise<{ success?: true; error?: string }> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    return {
      error:
        "PowerPoint conversion isn't set up yet (no CloudConvert key) — the file is saved, but slide images won't be generated until that's added.",
    };
  }

  const admin = createAdminClient();
  // A CloudConvert job imports the file "from a URL" — this signed URL is
  // how it reads our private storage without the bucket ever being public.
  const { data: signed } = await admin.storage
    .from("media")
    .createSignedUrl(input.storagePath, 60 * 30);
  if (!signed?.signedUrl) {
    return { error: "Couldn't create a temporary link to the uploaded file." };
  }

  const fileName = input.storagePath.split("/").pop() || "presentation.pptx";

  try {
    const res = await fetch(`${CLOUDCONVERT_API}/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // tag: mediaId — CloudConvert echoes this back on the webhook, so
      // that's how the webhook route knows which media_assets row this
      // finished job belongs to, with no separate mapping table needed.
      body: JSON.stringify({
        tag: input.mediaId,
        tasks: {
          "import-file": {
            operation: "import/url",
            url: signed.signedUrl,
            filename: fileName,
          },
          "convert-file": {
            operation: "convert",
            input: "import-file",
            input_format: "pptx",
            output_format: "jpg",
            engine: "office",
          },
          "export-file": {
            operation: "export/url",
            input: "convert-file",
          },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `CloudConvert couldn't start the conversion: ${text}` };
    }
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reach CloudConvert." };
  }
}
