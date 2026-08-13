"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase
    .from("users")
    .select("church_id, is_church_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.church_id) throw new Error("No church on this account.");
  if (!profile.is_church_admin) throw new Error("Only your church's Admin can plan services.");
  return { supabase, churchId: profile.church_id };
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Same idea as the roster builder's "New Month": make sure every
// weekly-pattern service type has an occurrence row for each matching
// weekday this month, so there's something to plan against even if no
// team has started a roster for this month yet. Safe to call every time
// the Planner page loads — upsert with ignoreDuplicates, so it's a no-op
// once the rows already exist. The signed-in user is already
// Admin-checked by requireAdmin() above, which is exactly who's allowed to
// write this church-wide branch of service_occurrences (see 0006/0008).
async function ensureWeeklyOccurrences(supabase: ServerClient, churchId: string, month: number, year: number) {
  const { data: serviceTypes } = await supabase
    .from("service_types")
    .select("id, pattern_type, default_weekday")
    .eq("church_id", churchId);

  const weekly = (serviceTypes ?? []).filter(
    (st) => st.pattern_type === "weekly" && st.default_weekday !== null
  );
  if (weekly.length === 0) return;

  const daysInMonth = new Date(year, month, 0).getDate();
  const rows: { service_type_id: string; date: string }[] = [];
  for (const st of weekly) {
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      if (d.getDay() === st.default_weekday) {
        rows.push({ service_type_id: st.id, date: isoDate(year, month, day) });
      }
    }
  }
  if (rows.length === 0) return;

  await supabase.from("service_occurrences").upsert(rows, { onConflict: "service_type_id,date", ignoreDuplicates: true });
}

export async function loadPlannerMonth(month: number, year: number) {
  const { supabase, churchId } = await requireAdmin();
  await ensureWeeklyOccurrences(supabase, churchId, month, year);
  revalidatePath("/dashboard/planner");
}

async function nextDisplayOrder(supabase: ServerClient, occurrenceId: string) {
  const { data } = await supabase
    .from("service_items")
    .select("display_order")
    .eq("service_occurrence_id", occurrenceId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.display_order ?? -1) + 1;
}

// `choice` is one of "song:<songId>" or "arr:<arrangementId>" — a single
// dropdown on the page covers both "the whole song" and "one specific
// named arrangement of it" without needing a second, dependent dropdown.
export async function addSongItem(occurrenceId: string, formData: FormData) {
  const { supabase, churchId } = await requireAdmin();
  const choice = String(formData.get("choice") || "");
  const [kind, id] = choice.split(":");
  if (!id) throw new Error("Pick a song.");

  let songId: string;
  let arrangementId: string | null = null;
  let title: string;

  if (kind === "arr") {
    const { data: arrangement } = await supabase
      .from("arrangements")
      .select("id, name, song_id")
      .eq("id", id)
      .single();
    if (!arrangement) throw new Error("Arrangement not found.");
    const { data: song } = await supabase.from("songs").select("title").eq("id", arrangement.song_id).single();
    songId = arrangement.song_id;
    arrangementId = arrangement.id;
    title = `${song?.title || "Song"} (${arrangement.name})`;
  } else {
    const { data: song } = await supabase.from("songs").select("id, title").eq("id", id).single();
    if (!song) throw new Error("Song not found.");
    songId = song.id;
    title = song.title;
  }

  const displayOrder = await nextDisplayOrder(supabase, occurrenceId);
  const { error } = await supabase.from("service_items").insert({
    church_id: churchId,
    service_occurrence_id: occurrenceId,
    title,
    item_type: "song",
    song_id: songId,
    arrangement_id: arrangementId,
    display_order: displayOrder,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/planner/${occurrenceId}`);
}

export async function addMediaItem(occurrenceId: string, formData: FormData) {
  const { supabase, churchId } = await requireAdmin();
  const mediaAssetId = String(formData.get("media_asset_id") || "");
  if (!mediaAssetId) throw new Error("Pick a media item.");

  const { data: media } = await supabase.from("media_assets").select("id, name").eq("id", mediaAssetId).single();
  if (!media) throw new Error("Media item not found.");

  const displayOrder = await nextDisplayOrder(supabase, occurrenceId);
  const { error } = await supabase.from("service_items").insert({
    church_id: churchId,
    service_occurrence_id: occurrenceId,
    title: media.name,
    item_type: "media",
    media_asset_id: media.id,
    display_order: displayOrder,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/planner/${occurrenceId}`);
}

export async function addCustomItem(occurrenceId: string, formData: FormData) {
  const { supabase, churchId } = await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Type something for this item.");

  const displayOrder = await nextDisplayOrder(supabase, occurrenceId);
  const { error } = await supabase.from("service_items").insert({
    church_id: churchId,
    service_occurrence_id: occurrenceId,
    title,
    item_type: "custom",
    display_order: displayOrder,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/planner/${occurrenceId}`);
}

export async function removeServiceItem(occurrenceId: string, itemId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("service_items").delete().eq("id", itemId).eq("service_occurrence_id", occurrenceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/planner/${occurrenceId}`);
}

export async function moveServiceItem(occurrenceId: string, itemId: string, direction: "up" | "down") {
  const { supabase } = await requireAdmin();
  const { data: items } = await supabase
    .from("service_items")
    .select("id, display_order")
    .eq("service_occurrence_id", occurrenceId)
    .order("display_order", { ascending: true });
  if (!items) return;

  const idx = items.findIndex((i) => i.id === itemId);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapWith < 0 || swapWith >= items.length) return;

  const a = items[idx];
  const b = items[swapWith];
  await Promise.all([
    supabase.from("service_items").update({ display_order: b.display_order }).eq("id", a.id),
    supabase.from("service_items").update({ display_order: a.display_order }).eq("id", b.id),
  ]);
  revalidatePath(`/dashboard/planner/${occurrenceId}`);
}
