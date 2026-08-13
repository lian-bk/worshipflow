"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { splitLyricsIntoSlides, detectMarker } from "@/lib/lyrics";
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
  const lang = String(formData.get("lang") || "en").trim() || "en";
  const musicalKey = String(formData.get("musical_key") || "").trim() || null;

  if (!title) throw new Error("Give the song a title.");

  const { data: song, error } = await supabase
    .from("songs")
    .insert({ church_id: churchId, title, lyrics, lang, musical_key: musicalKey })
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
// Bulk import (e.g. a church's existing songbook exported as JSON)
// ---------------------------------------------------------------------

export type ImportSongInput = {
  title: string;
  number?: number | null;
  key?: string | null;
  category?: string | null;
  lang?: string | null;
  sections?: { label?: string | null; lines?: string[] | null }[] | null;
};

export type ImportSongsResult = { imported: number; skipped: number; errors: string[] };

// Every song gets its id generated here (instead of leaving it to the
// database default) so slides and tag links can be built for ALL songs
// up front and sent as a handful of bulk inserts, rather than one round
// trip per song — the difference between a few seconds and potentially
// minutes for a few-hundred-song songbook.
export async function importSongs(rawSongs: ImportSongInput[]): Promise<ImportSongsResult> {
  const { supabase, churchId } = await requireChurch();

  if (!Array.isArray(rawSongs)) throw new Error("That file doesn't look like a list of songs.");
  if (rawSongs.length === 0) return { imported: 0, skipped: 0, errors: [] };
  if (rawSongs.length > 2000) throw new Error("That's too many songs for one import (max 2000) — split the file.");

  const errors: string[] = [];
  const songRows: {
    id: string;
    church_id: string;
    title: string;
    lyrics: string;
    lang: string;
    musical_key: string | null;
    songbook_number: number | null;
  }[] = [];
  const slideRows: {
    song_id: string;
    label_type: SlideLabelType;
    label_number: number | null;
    custom_label: string | null;
    content: string;
    display_order: number;
  }[] = [];
  const categoryNames = new Set<string>();
  const categoryBySongId = new Map<string, string>();

  for (const raw of rawSongs) {
    const title = String(raw.title || "").trim();
    if (!title) {
      errors.push("Skipped a song with no title.");
      continue;
    }

    const songId = randomUUID();
    const lang = String(raw.lang || "en").trim() || "en";
    const musicalKey = raw.key ? String(raw.key).trim() || null : null;
    const songbookNumber = typeof raw.number === "number" ? raw.number : null;
    const sections = Array.isArray(raw.sections) ? raw.sections : [];

    const lyricsText = sections
      .map((s) => `${s.label ? s.label + "\n" : ""}${(s.lines || []).join("\n")}`)
      .join("\n\n");

    songRows.push({
      id: songId,
      church_id: churchId,
      title,
      lyrics: lyricsText,
      lang,
      musical_key: musicalKey,
      songbook_number: songbookNumber,
    });

    sections.forEach((section, index) => {
      const label = section.label ? String(section.label).trim() : "";
      const marker = label ? detectMarker(label) : null;
      slideRows.push({
        song_id: songId,
        label_type: marker?.type ?? "other",
        label_number: marker?.number ?? null,
        custom_label: marker ? null : label || null,
        content: (section.lines || []).join("\n"),
        display_order: index,
      });
    });

    const category = raw.category ? String(raw.category).trim() : "";
    if (category) {
      categoryNames.add(category);
      categoryBySongId.set(songId, category);
    }
  }

  if (songRows.length === 0) {
    return { imported: 0, skipped: rawSongs.length, errors };
  }

  const { error: songsError } = await supabase.from("songs").insert(songRows);
  if (songsError) throw new Error(songsError.message);

  if (slideRows.length > 0) {
    const { error: slidesError } = await supabase.from("song_slides").insert(slideRows);
    if (slidesError) {
      errors.push(`Songs were created, but some slides didn't save: ${slidesError.message}`);
    }
  }

  if (categoryNames.size > 0) {
    const { data: tags, error: tagsError } = await supabase
      .from("tags")
      .upsert(
        Array.from(categoryNames).map((name) => ({ church_id: churchId, name })),
        { onConflict: "church_id,name" }
      )
      .select("id, name");

    if (tagsError) {
      errors.push(`Songs were created, but categories couldn't be saved as tags: ${tagsError.message}`);
    } else {
      const tagIdByName = new Map((tags ?? []).map((t) => [t.name, t.id]));
      const songTagRows = Array.from(categoryBySongId.entries())
        .map(([songId, category]) => {
          const tagId = tagIdByName.get(category);
          return tagId ? { song_id: songId, tag_id: tagId } : null;
        })
        .filter((row): row is { song_id: string; tag_id: string } => row !== null);

      if (songTagRows.length > 0) {
        const { error: linkError } = await supabase.from("song_tags").insert(songTagRows);
        if (linkError) {
          errors.push(`Songs were created, but linking categories to tags failed: ${linkError.message}`);
        }
      }
    }
  }

  revalidatePath("/dashboard/library");
  return { imported: songRows.length, skipped: rawSongs.length - songRows.length, errors };
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
