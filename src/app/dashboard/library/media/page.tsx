import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "./upload-form";
import { VideoReferenceForm } from "./video-reference-form";
import { MediaGrid, type MediaItem } from "./media-grid";
import Link from "next/link";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q, tag } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("church_id").eq("id", user.id).single()
    : { data: null };
  const churchId = profile?.church_id ?? null;

  // Top-level items only — PowerPoint slide images (source_media_id set) nest
  // under their parent instead of showing up as separate top-level tiles.
  const [{ data: topLevel }, { data: allChildren }, { data: tags }, { data: mediaTags }] =
    await Promise.all([
      supabase
        .from("media_assets")
        .select(
          "id, name, kind, storage_path, storage_source, external_reference, pptx_conversion_status, source_media_id, display_order, created_at"
        )
        .is("source_media_id", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("media_assets")
        .select("id, name, storage_path, source_media_id, display_order")
        .not("source_media_id", "is", null)
        .order("display_order"),
      supabase.from("tags").select("id, name").order("name"),
      supabase.from("media_tags").select("media_asset_id, tag_id"),
    ]);

  const tagsByMedia = new Map<string, Set<string>>();
  for (const row of mediaTags ?? []) {
    if (!tagsByMedia.has(row.media_asset_id)) tagsByMedia.set(row.media_asset_id, new Set());
    tagsByMedia.get(row.media_asset_id)!.add(row.tag_id);
  }

  const childrenByParent = new Map<string, { id: string; name: string; storage_path: string | null }[]>();
  for (const child of allChildren ?? []) {
    if (!child.source_media_id) continue;
    if (!childrenByParent.has(child.source_media_id)) childrenByParent.set(child.source_media_id, []);
    childrenByParent.get(child.source_media_id)!.push(child);
  }

  // Generate signed URLs (bucket is private) for every storage-backed file we're
  // about to display — parents and children alike.
  const pathsNeedingUrls = new Set<string>();
  for (const item of topLevel ?? []) {
    if (item.storage_path) pathsNeedingUrls.add(item.storage_path);
  }
  for (const child of allChildren ?? []) {
    if (child.storage_path) pathsNeedingUrls.add(child.storage_path);
  }
  const signedUrlByPath = new Map<string, string>();
  await Promise.all(
    Array.from(pathsNeedingUrls).map(async (path) => {
      const { data } = await supabase.storage.from("media").createSignedUrl(path, 3600);
      if (data?.signedUrl) signedUrlByPath.set(path, data.signedUrl);
    })
  );

  const query = (q ?? "").trim().toLowerCase();
  const filtered = (topLevel ?? []).filter((item) => {
    const matchesQuery = !query || item.name.toLowerCase().includes(query);
    const matchesTag = !tag || tagsByMedia.get(item.id)?.has(tag);
    return matchesQuery && matchesTag;
  });

  const items: MediaItem[] = filtered.map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.kind,
    storageSource: item.storage_source,
    externalReference: item.external_reference,
    pptxConversionStatus: item.pptx_conversion_status,
    signedUrl: item.storage_path ? signedUrlByPath.get(item.storage_path) ?? null : null,
    tags: Array.from(tagsByMedia.get(item.id) ?? []),
    children: (childrenByParent.get(item.id) ?? [])
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        signedUrl: c.storage_path ? signedUrlByPath.get(c.storage_path) ?? null : null,
      })),
  }));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Media</h1>
          <p className="mt-1 text-sm text-slate-500">
            Images and PowerPoint files upload here. For videos, either point to a file on your
            own presentation laptop, or (coming soon) connect Google Drive — large video files
            never get uploaded to our storage by default.
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {churchId && <UploadForm churchId={churchId} />}
        <VideoReferenceForm />
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search media name…"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          name="tag"
          defaultValue={tag ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All tags</option>
          {(tags ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Filter
        </button>
        {(q || tag) && (
          <Link href="/dashboard/library/media" className="text-sm text-slate-500 underline">
            Clear
          </Link>
        )}
      </form>

      <MediaGrid items={items} allTags={tags ?? []} />
    </div>
  );
}
