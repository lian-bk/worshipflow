import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SlideList } from "./slide-list";
import { ArrangementBuilder } from "./arrangement-builder";
import { ThemePicker } from "./theme-picker";
import { SongTagsEditor } from "./song-tags-editor";
import { DeleteSongButton } from "./delete-song-button";

export default async function SongEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: song } = await supabase
    .from("songs")
    .select("id, title, lyrics, theme_id")
    .eq("id", id)
    .single();

  if (!song) notFound();

  const [{ data: slides }, { data: arrangements }, { data: arrangementItems }, { data: themes }, { data: tags }, { data: songTagRows }] =
    await Promise.all([
      supabase
        .from("song_slides")
        .select("id, label_type, label_number, custom_label, content, display_order")
        .eq("song_id", id)
        .order("display_order"),
      supabase.from("arrangements").select("id, name").eq("song_id", id).order("created_at"),
      supabase.from("arrangement_items").select("id, arrangement_id, song_slide_id, display_order"),
      supabase
        .from("themes")
        .select("id, name, background_color, text_color, font_family, is_starter")
        .order("is_starter", { ascending: false })
        .order("name"),
      supabase.from("tags").select("id, name").order("name"),
      supabase.from("song_tags").select("tag_id").eq("song_id", id),
    ]);

  const relevantArrangementItems = (arrangementItems ?? []).filter((item) =>
    (arrangements ?? []).some((a) => a.id === item.arrangement_id)
  );

  const currentTagIds = new Set((songTagRows ?? []).map((r) => r.tag_id));
  const songTags = (tags ?? []).filter((t) => currentTagIds.has(t.id));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/library" className="text-sm text-slate-500 hover:underline">
        ← Back to Songs
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">{song.title}</h1>
        <DeleteSongButton songId={song.id} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <ThemePicker songId={song.id} themes={themes ?? []} currentThemeId={song.theme_id} />
        <SongTagsEditor songId={song.id} allTags={tags ?? []} currentTags={songTags ?? []} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Slides</h2>
        <SlideList songId={song.id} slides={slides ?? []} />
      </div>

      <div className="mt-10 border-t border-slate-200 pt-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Arrangements</h2>
        <p className="mb-3 text-sm text-slate-500">
          Save a reusable running order for this song — the same slide can appear more than
          once (e.g. Chorus repeated).
        </p>
        <ArrangementBuilder
          songId={song.id}
          slides={slides ?? []}
          arrangements={arrangements ?? []}
          arrangementItems={relevantArrangementItems}
        />
      </div>
    </div>
  );
}
