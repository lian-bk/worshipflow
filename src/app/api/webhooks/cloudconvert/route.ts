// CloudConvert calls this URL when a PowerPoint→slide-images job finishes (or
// fails). One-time setup: in the CloudConvert dashboard, add a webhook
// pointed at https://<your-app>/api/webhooks/cloudconvert for the
// "job.finished" and "job.failed" events. Optionally set
// CLOUDCONVERT_WEBHOOK_SECRET (CloudConvert's "Signing Secret") so this route
// can verify requests really came from CloudConvert; if it's not set, the
// signature check is skipped (still works, just less strict).
//
// Runs on the admin (service-role) client since this is called by
// CloudConvert, not a logged-in church member — there's no user session to
// check RLS against here.
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type CloudConvertFile = { filename: string; url: string };
type CloudConvertTask = {
  name?: string;
  operation?: string;
  result?: { files?: CloudConvertFile[] };
};
type CloudConvertWebhookPayload = {
  event?: string;
  job?: { id: string; tag?: string | null; tasks?: CloudConvertTask[] };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const secret = process.env.CLOUDCONVERT_WEBHOOK_SECRET;
  if (secret) {
    const signature = request.headers.get("cloudconvert-signature") || "";
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (signature !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: CloudConvertWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // tag was set to the media_assets.id when the job was created (see
  // src/lib/cloudconvert.ts) — that's how we map this job back to a row.
  const mediaId = payload.job?.tag;
  if (!mediaId) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  if (payload.event === "job.failed") {
    await admin.from("media_assets").update({ pptx_conversion_status: "failed" }).eq("id", mediaId);
    return NextResponse.json({ ok: true });
  }

  if (payload.event !== "job.finished") {
    return NextResponse.json({ ok: true });
  }

  const { data: parent } = await admin
    .from("media_assets")
    .select("id, name, church_id")
    .eq("id", mediaId)
    .single();
  if (!parent) return NextResponse.json({ ok: true });

  const exportTask = (payload.job?.tasks ?? []).find(
    (t) => t.name === "export-file" || t.operation === "export/url"
  );
  const files = (exportTask?.result?.files ?? [])
    .slice()
    .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));

  let created = 0;
  for (const file of files) {
    const res = await fetch(file.url);
    if (!res.ok) continue;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = `${parent.church_id}/media/${crypto.randomUUID()}.jpg`;

    const { error: uploadError } = await admin.storage.from("media").upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (uploadError) continue;

    await admin.from("media_assets").insert({
      church_id: parent.church_id,
      name: `${parent.name} — Slide ${created + 1}`,
      storage_path: path,
      kind: "image",
      storage_source: "supabase",
      source_media_id: parent.id,
      display_order: created,
    });
    created++;
  }

  await admin
    .from("media_assets")
    .update({ pptx_conversion_status: created > 0 ? "complete" : "failed" })
    .eq("id", mediaId);

  return NextResponse.json({ ok: true, slides: created });
}
