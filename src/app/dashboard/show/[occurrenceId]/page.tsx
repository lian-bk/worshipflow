import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slideLabelDisplay } from "@/lib/slide-labels";
import { ServiceTabs } from "../../service/service-tabs";
import { ensureLiveLink } from "./actions";
import { ShowView, type SetListItem, type Slide } from "./show-view";

const DEFAULT_BG = "#0f172a";
const DEFAULT_TEXT = "#ffffff";

export default async function ShowPage({ params }: { params: Promise<{ occurrenceId: string }> }) {
  const { occurrenceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("church_id, is_church_admin").eq("id", user.id).single()
    : { data: null };
  if (!profile?.church_id) notFound();

  if (!profile.is_church_admin) {
    return (
      <div>
        <ServiceTabs />
        <h1 className="text-2xl font-semibold text-slate-900">Live Show</h1>
        <p className="mt-2 text-sm text-slate-500">Only your church&rsquo;s Admin can run the live show.</p>
      </div>
    );
  }

  const { data: occurrence } = await supabase
    .from("service_occurrences")
    .select("id, date, note, service_type_id")
    .eq("id", occurrenceId)
    .single();
  if (!occurrence) notFound();

  const { data: serviceType } = occurrence.service_type_id
    ? await supabase.from("service_types").select("name").eq("id", occurrence.service_type_id).single()
    : { data: null };

  const { data: churchRow } = await supabase.from("churches").select("name, tagline").eq("id", profile.church_id).single();

  const liveToken = await ensureLiveLink(occurrenceId, churchRow?.name || "Church", churchRow?.tagline || "");

  const { data: items } = await supabase
    .from("service_items")
    .select("id, title, item_type, song_id, arrangement_id, media_asset_id, display_order")
    .eq("service_occurrence_id", occurrenceId)
    .order("display_order");

  const songIds = [...new Set((items ?? []).filter((i) => i.item_type === "song" && i.song_id).map((i) => i.song_id as string))];
  const arrangementIds = [
    ...new Set((items ?? []).filter((i) => i.item_type === "song" && i.arrangement_id).map((i) => i.arrangement_id as string)),
  ];
  const mediaAssetIds = [
    ...new Set((items ?? []).filter((i) => i.item_type === "media" && i.media_asset_id).map((i) => i.media_asset_id as string)),
  ];

  type SongRow = { id: string; title: string; theme_id: string | null };
  type SlideRow = {
    id: string;
    song_id: string;
    label_type: "verse" | "prechorus" | "chorus" | "bridge" | "intro" | "outro" | "tag" | "other";
    label_number: number | null;
    custom_label: string | null;
    content: string;
    display_order: number;
    text_scale: number | null;
  };
  type ArrangementItemRow = { arrangement_id: string; song_slide_id: string; display_order: number };
  type MediaAssetRow = { id: string; name: string; kind: string | null; storage_path: string | null; storage_source: string };

  const [{ data: songs }, { data: slides }, { data: arrangementItems }, { data: mediaAssets }, { data: photoAssets }] = await Promise.all([
    songIds.length
      ? supabase.from("songs").select("id, title, theme_id").in("id", songIds)
      : Promise.resolve({ data: [] as SongRow[] }),
    songIds.length
      ? supabase
          .from("song_slides")
          .select("id, song_id, label_type, label_number, custom_label, content, display_order, text_scale")
          .in("song_id", songIds)
          .order("display_order")
      : Promise.resolve({ data: [] as SlideRow[] }),
    arrangementIds.length
      ? supabase
          .from("arrangement_items")
          .select("arrangement_id, song_slide_id, display_order")
          .in("arrangement_id", arrangementIds)
          .order("display_order")
      : Promise.resolve({ data: [] as ArrangementItemRow[] }),
    mediaAssetIds.length
      ? supabase.from("media_assets").select("id, name, kind, storage_path, storage_source").in("id", mediaAssetIds)
      : Promise.resolve({ data: [] as MediaAssetRow[] }),
    // The church's whole photo library, for the Live Show page's Media /
    // Background panel — independent of what's actually in this service,
    // since the operator may want to click in a photo on the fly.
    supabase
      .from("media_assets")
      .select("id, name, storage_path, storage_source")
      .eq("kind", "image")
      .eq("storage_source", "supabase")
      .is("source_media_id", null)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const themeIds = [...new Set((songs ?? []).map((s) => s.theme_id).filter((id): id is string => !!id))];
  const { data: themes } = themeIds.length
    ? await supabase
        .from("themes")
        .select("id, background_color, text_color, font_family, background_image_path, text_h_align, text_v_align, text_scale")
        .in("id", themeIds)
    : { data: [] };
  const themeById = new Map((themes ?? []).map((t) => [t.id, t]));
  const songById = new Map((songs ?? []).map((s) => [s.id, s]));
  const slideById = new Map((slides ?? []).map((s) => [s.id, s]));
  const slidesBySong = new Map<string, typeof slides>();
  for (const s of slides ?? []) {
    if (!slidesBySong.has(s.song_id)) slidesBySong.set(s.song_id, []);
    slidesBySong.get(s.song_id)!.push(s);
  }
  const arrangementItemsByArrangement = new Map<string, typeof arrangementItems>();
  for (const ai of arrangementItems ?? []) {
    if (!arrangementItemsByArrangement.has(ai.arrangement_id)) arrangementItemsByArrangement.set(ai.arrangement_id, []);
    arrangementItemsByArrangement.get(ai.arrangement_id)!.push(ai);
  }

  // Signed URLs for image media items, plus any theme background photos —
  // video/PPT playback inside the projector window is a bigger, separate
  // piece of work (matches the roster export's "deferred" list: this phase
  // covers slides + projector output, not the full media pipeline yet).
  const imagePaths = new Set<string>();
  for (const m of mediaAssets ?? []) {
    if (m.kind === "image" && m.storage_path && m.storage_source === "supabase") imagePaths.add(m.storage_path);
  }
  for (const t of themes ?? []) {
    if (t.background_image_path) imagePaths.add(t.background_image_path);
  }
  for (const p of photoAssets ?? []) {
    if (p.storage_path) imagePaths.add(p.storage_path);
  }
  const signedUrlByPath = new Map<string, string>();
  await Promise.all(
    [...imagePaths].map(async (path) => {
      const { data } = await supabase.storage.from("media").createSignedUrl(path, 3600);
      if (data?.signedUrl) signedUrlByPath.set(path, data.signedUrl);
    })
  );
  const mediaById = new Map((mediaAssets ?? []).map((m) => [m.id, m]));
  const photoLibrary = (photoAssets ?? [])
    .filter((p) => p.storage_path && signedUrlByPath.has(p.storage_path))
    .map((p) => ({ id: p.id, name: p.name, url: signedUrlByPath.get(p.storage_path!)! }));

  function themeFor(songThemeId: string | null) {
    const t = songThemeId ? themeById.get(songThemeId) : undefined;
    return {
      backgroundColor: t?.background_color || DEFAULT_BG,
      textColor: t?.text_color || DEFAULT_TEXT,
      fontFamily: t && t.font_family !== "system" ? t.font_family : undefined,
      backgroundImageUrl: t?.background_image_path ? signedUrlByPath.get(t.background_image_path) : undefined,
      textHAlign: (t?.text_h_align || "center") as "left" | "center" | "right",
      textVAlign: (t?.text_v_align || "middle") as "top" | "middle" | "bottom",
      textScale: t?.text_scale ?? 100,
    };
  }

  const setList: SetListItem[] = (items ?? []).map((item) => {
    if (item.item_type === "song" && item.song_id) {
      const song = songById.get(item.song_id);
      const theme = themeFor(song?.theme_id ?? null);
      let orderedSlides: typeof slides = [];
      if (item.arrangement_id && arrangementItemsByArrangement.has(item.arrangement_id)) {
        orderedSlides = (arrangementItemsByArrangement.get(item.arrangement_id) ?? [])
          .map((ai) => slideById.get(ai.song_slide_id))
          .filter((s): s is NonNullable<typeof s> => !!s);
      } else {
        orderedSlides = slidesBySong.get(item.song_id) ?? [];
      }
      const slidesOut: Slide[] = orderedSlides.map((s) => ({
        id: s.id,
        kind: "lyric",
        label: slideLabelDisplay(s),
        content: s.content,
        ...theme,
        // A slide's own text size (set in Library → the song's slides)
        // overrides the theme's, when present.
        textScale: s.text_scale ?? theme.textScale,
      }));
      return { id: item.id, title: item.title, itemType: "song", slides: slidesOut };
    }

    if (item.item_type === "media" && item.media_asset_id) {
      const media = mediaById.get(item.media_asset_id);
      const imageUrl = media?.storage_path ? signedUrlByPath.get(media.storage_path) : undefined;
      const slide: Slide = imageUrl
        ? { id: item.id, kind: "image", content: item.title, imageUrl, backgroundColor: "#000000", textColor: DEFAULT_TEXT }
        : { id: item.id, kind: "title", content: item.title, backgroundColor: DEFAULT_BG, textColor: DEFAULT_TEXT };
      return { id: item.id, title: item.title, itemType: "media", slides: [slide] };
    }

    return {
      id: item.id,
      title: item.title,
      itemType: "custom",
      slides: [{ id: item.id, kind: "title", content: item.title, backgroundColor: DEFAULT_BG, textColor: DEFAULT_TEXT }],
    };
  });

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <ServiceTabs />
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p>
            <Link href={`/dashboard/planner/${occurrenceId}`} className="text-sm text-slate-500 underline">
              ← Back to planning
            </Link>
          </p>
          <h1 className="text-xl font-semibold text-slate-900">
            {serviceType?.name || "Service"} —{" "}
            {new Date(occurrence.date + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </h1>
        </div>
      </div>

      <ShowView
        setList={setList}
        churchName={churchRow?.name || "Church"}
        tagline={churchRow?.tagline || ""}
        occurrenceId={occurrenceId}
        liveToken={liveToken}
        photoLibrary={photoLibrary}
      />
    </div>
  );
}
