"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { splitLyricsIntoSlides } from "@/lib/lyrics";
import type { SlideLabelType } from "@/lib/supabase/types";

// Every action re-checks who's signed in and which church they belong to —
// RLS backs this up at the database layer too, but resolving church_id here
// is also how we know what to stamp on new rows (RLS's "with check" clause
// requires an exact match, so we can't just omit it).
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

// ---------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------

export async function createSong(formData: FormData) {
  const { supabase, churchId } = await requireChurch();
  const title = String(formData.get("title") || "").trim();
  const lyrics = String(formData.get("lyrics") || "");

  if (!title) throw new Error("Give the song a title.");

  const { data: song, error } = await supabase
    .from("songs")
    .insert({ church_id: churchId, title, lyrics })
    .select("id")
    .single();

  if (error || !song) throw new Error(error?.message || "Couldn't create the song.");

  const parsed = splitLyricsIntoSlides(lyrics);
  if (parsed.length > 0) {
    const rows = parsed.map((slide, index) => ({
      song_id: song.id,
      label_type: slide.labelType,
      label_number: slide.labelNumber,
      custom_label: slide.customLabel,
      content: slide.content,
      display_order: index,
    }));
    await supabase.from("song_slides").insert(rows);
  }

  revalidatePath("/dashboard/library");
  redirect(`/dashboard/library/songs/${song.id}`);
}

export async function deleteSong(songId: string) {
  const { supabase } = await requireChurch();
  await supabase.from("songs").delete().eq("id", songId);
  revalidatePath("/dashboard/library");
  redirect("/dashboard/library");
}

export async function resplitSongFromLyrics(songId: string) {
  const { supabase } = await requireChurch();
  const { data: song } = await supabase.from("songs").select("lyrics").eq("id", songId).single();
  if (!song) throw new Error("Song not found.");

  await supabase.from("song_slides").delete().eq("song_id", songId);

  const parsed = splitLyricsIntoSlides(song.lyrics ?? "");
  if (parsed.length > 0) {
    const rows = parsed.map((slide, index) => ({
      song_id: songId,
      label_type: slide.labelType,
      label_number: slide.labelNumber,
      custom_label: slide.customLabel,
      content: slide.content,
      display_order: index,
    }));
    await supabase.from("song_slides").insert(rows);
  }

  revalidatePath(`/dashboard/library/songs/${songId}`);
}

export async function updateSongTheme(songId: string, themeId: string | null) {
  const { supabase } = await requireChurch();
  await supabase.from("songs").update({ theme_id: themeId }).eq("id", songId);
  revalidatePath(`/dashboard/library/songs/${songId}`);
}

// ---------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------

export async function updateSlideLabel(
  slideId: string,
  labelType: SlideLabelType,
  labelNumber: number | null,
  customLabel: string | null
) {
  const { supabase } = await requireChurch();
  const { data: slide } = await supabase
    .from("song_slides")
    .update({ label_type: labelType, label_number: labelNumber, custom_label: customLabel })
    .eq("id", slideId)
    .select("song_id")
    .single();
  if (slide) revalidatePath(`/dashboard/library/songs/${slide.song_id}`);
}

export async function updateSlideContent(slideId: string, content: string) {
  const { supabase } = await requireChurch();
  const { data: slide } = await supabase
    .from("song_slides")
    .update({ content })
    .eq("id", slideId)
    .select("song_id")
    .single();
  if (slide) revalidatePath(`/dashboard/library/songs/${slide.song_id}`);
}

export async function addSlide(songId: string, afterDisplayOrder: number) {
  const { supabase } = await requireChurch();
  // Push every later slide down one, then insert the new blank slide into the gap.
  const { data: slides } = await supabase
    .from("song_slides")
    .select("id, display_order")
    .eq("song_id", songId)
    .order("display_order");

  const later = (slides ?? []).filter((s) => s.display_order > afterDisplayOrder);
  for (const s of later) {
    await supabase.from("song_slides").update({ display_order: s.display_order + 1 }).eq("id", s.id);
  }

  await supabase.from("song_slides").insert({
    song_id: songId,
    label_type: "other",
    content: "",
    display_order: afterDisplayOrder + 1,
  });

  revalidatePath(`/dashboard/library/songs/${songId}`);
}

export async function deleteSlide(slideId: string) {
  const { supabase } = await requireChurch();
  const { data: slide } = await supabase
    .from("song_slides")
    .delete()
    .eq("id", slideId)
    .select("song_id")
    .single();
  if (slide) revalidatePath(`/dashboard/library/songs/${slide.song_id}`);
}

export async function reorderSlides(songId: string, orderedSlideIds: string[]) {
  const { supabase } = await requireChurch();
  await Promise.all(
    orderedSlideIds.map((id, index) =>
      supabase.from("song_slides").update({ display_order: index }).eq("id", id)
    )
  );
  revalidatePath(`/dashboard/library/songs/${songId}`);
}

// ---------------------------------------------------------------------
// Arrangements
// ---------------------------------------------------------------------

export async function createArrangement(songId: string, name: string, slideIds: string[]) {
  const { supabase } = await requireChurch();
  const { data: arrangement, error } = await supabase
    .from("arrangements")
    .insert({ song_id: songId, name })
    .select("id")
    .single();
  if (error || !arrangement) throw new Error(error?.message || "Couldn't create arrangement.");

  if (slideIds.length > 0) {
    const rows = slideIds.map((slideId, index) => ({
      arrangement_id: arrangement.id,
      song_slide_id: slideId,
      display_order: index,
    }));
    await supabase.from("arrangement_items").insert(rows);
  }

  revalidatePath(`/dashboard/library/songs/${songId}`);
}

export async function updateArrangement(
  arrangementId: string,
  songId: string,
  name: string,
  slideIds: string[]
) {
  const { supabase } = await requireChurch();
  await supabase.from("arrangements").update({ name }).eq("id", arrangementId);
  await supabase.from("arrangement_items").delete().eq("arrangement_id", arrangementId);
  if (slideIds.length > 0) {
    const rows = slideIds.map((slideId, index) => ({
      arrangement_id: arrangementId,
      song_slide_id: slideId,
      display_order: index,
    }));
    await supabase.from("arrangement_items").insert(rows);
  }
  revalidatePath(`/dashboard/library/songs/${songId}`);
}

export async function deleteArrangement(arrangementId: string, songId: string) {
  const { supabase } = await requireChurch();
  await supabase.from("arrangements").delete().eq("id", arrangementId);
  revalidatePath(`/dashboard/library/songs/${songId}`);
}

// ---------------------------------------------------------------------
// Tags (shared between songs and media)
// ---------------------------------------------------------------------

export async function createTag(name: string) {
  const { supabase, churchId } = await requireChurch();
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from("tags")
    .upsert({ church_id: churchId, name: trimmed }, { onConflict: "church_id,name" })
    .select("id, name")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setSongTags(songId: string, tagIds: string[]) {
  const { supabase } = await requireChurch();
  await supabase.from("song_tags").delete().eq("song_id", songId);
  if (tagIds.length > 0) {
    await supabase.from("song_tags").insert(tagIds.map((tagId) => ({ song_id: songId, tag_id: tagId })));
  }
  revalidatePath("/dashboard/library");
  revalidatePath(`/dashboard/library/songs/${songId}`);
}

export async function setMediaTags(mediaId: string, tagIds: string[]) {
  const { supabase } = await requireChurch();
  await supabase.from("media_tags").delete().eq("media_asset_id", mediaId);
  if (tagIds.length > 0) {
    await supabase
      .from("media_tags")
      .insert(tagIds.map((tagId) => ({ media_asset_id: mediaId, tag_id: tagId })));
  }
  revalidatePath("/dashboard/library/media");
}

// ---------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------

export async function createTheme(formData: FormData) {
  const { supabase, churchId } = await requireChurch();
  const name = String(formData.get("name") || "").trim();
  const backgroundColor = String(formData.get("background_color") || "#0f172a");
  const textColor = String(formData.get("text_color") || "#ffffff");
  const fontFamily = String(formData.get("font_family") || "system");
  if (!name) throw new Error("Give the theme a name.");

  await supabase.from("themes").insert({
    church_id: churchId,
    name,
    background_color: backgroundColor,
    text_color: textColor,
    font_family: fontFamily,
  });
  revalidatePath("/dashboard/library/themes");
}

export async function deleteTheme(themeId: string) {
  const { supabase } = await requireChurch();
  await supabase.from("themes").delete().eq("id", themeId);
  revalidatePath("/dashboard/library/themes");
}
