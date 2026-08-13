"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { startPptxConversion } from "@/lib/cloudconvert";

async function requireChurch() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase
    .from("users")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!profile?.church_id) throw new Error("No church on this account.");
  return { supabase, churchId: profile.church_id };
}

// Called after a file has already been uploaded directly from the browser to
// Supabase Storage (see upload-form.tsx) — this just records the metadata
// row. Splitting it this way avoids sending file bytes through a Server
// Action, which has a much smaller payload limit than direct-to-storage
// uploads do.
export async function createMediaRecord(input: {
  name: string;
  storagePath: string;
  kind: "image" | "pptx";
}): Promise<{ warning?: string }> {
  const { supabase, churchId } = await requireChurch();
  const { data: media, error } = await supabase
    .from("media_assets")
    .insert({
      church_id: churchId,
      name: input.name,
      storage_path: input.storagePath,
      kind: input.kind,
      storage_source: "supabase",
      pptx_conversion_status: input.kind === "pptx" ? "pending" : null,
    })
    .select("id")
    .single();
  if (error || !media) throw new Error(error?.message || "Couldn't save the file.");

  revalidatePath("/dashboard/library/media");

  if (input.kind === "pptx") {
    const result = await startPptxConversion({ mediaId: media.id, storagePath: input.storagePath });
    if (result.error) return { warning: result.error };
  }

  return {};
}

// The pluggable "no upload" storage source — for large video files a church
// keeps on their own presentation laptop instead of uploading to us.
export async function createLocalReferenceMedia(formData: FormData) {
  const { supabase, churchId } = await requireChurch();
  const name = String(formData.get("name") || "").trim();
  const reference = String(formData.get("reference") || "").trim();
  if (!name) throw new Error("Give the video a name.");

  const { error } = await supabase.from("media_assets").insert({
    church_id: churchId,
    name,
    kind: "video",
    storage_source: "local_reference",
    external_reference: reference || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/library/media");
}

export async function deleteMedia(mediaId: string) {
  const { supabase } = await requireChurch();
  // Delete any child slide-images from a converted PowerPoint first (source_media_id
  // has ON DELETE CASCADE at the DB level too, but we also want to remove their
  // storage files, not just the rows).
  const { data: children } = await supabase
    .from("media_assets")
    .select("storage_path")
    .eq("source_media_id", mediaId);
  const { data: parent } = await supabase
    .from("media_assets")
    .select("storage_path")
    .eq("id", mediaId)
    .single();

  const paths = [...(children ?? []), ...(parent ? [parent] : [])]
    .map((m) => m.storage_path)
    .filter((p): p is string => !!p);

  if (paths.length > 0) {
    await supabase.storage.from("media").remove(paths);
  }

  await supabase.from("media_assets").delete().eq("id", mediaId);
  revalidatePath("/dashboard/library/media");
}
