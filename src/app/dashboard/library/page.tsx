import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ImportSongsForm } from "./import-songs-form";

export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q, tag } = await searchParams;
  const supabase = await createClient();

  const [{ data: songs }, { data: tags }, { data: songTags }] = await Promise.all([
    supabase
      .from("songs")
      .select("id, title, lyrics, lang, musical_key, songbook_number, created_at")
      .order("title"),
    supabase.from("tags").select("id, name").order("name"),
    supabase.from("song_tags").select("song_id, tag_id"),
  ]);

  const tagsBySong = new Map<string, Set<string>>();
  for (const row of songTags ?? []) {
    if (!tagsBySong.has(row.song_id)) tagsBySong.set(row.song_id, new Set());
    tagsBySong.get(row.song_id)!.add(row.tag_id);
  }

  const query = (q ?? "").trim().toLowerCase();
  const filtered = (songs ?? []).filter((song) => {
    const matchesQuery =
      !query ||
      song.title.toLowerCase().includes(query) ||
      (song.lyrics ?? "").toLowerCase().includes(query);
    const matchesTag = !tag || tagsBySong.get(song.id)?.has(tag);
    return matchesQuery && matchesTag;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Songs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Paste lyrics, split them into labeled slides, and build arrangements.
          </p>
        </div>
        <Link
          href="/dashboard/library/songs/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New Song
        </Link>
      </div>

      <ImportSongsForm />

      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search title or lyrics…"
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
          <Link href="/dashboard/library" className="text-sm text-slate-500 underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            {songs && songs.length > 0
              ? "No songs match your search/filter."
              : "No songs yet — click “+ New Song” to add your first one."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((song) => (
              <li key={song.id}>
                <Link
                  href={`/dashboard/library/songs/${song.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                >
                  <span className={`font-medium text-slate-900 ${song.lang === "falam" ? "falam-text" : ""}`}>
                    {song.songbook_number ? `#${song.songbook_number} ` : ""}
                    {song.title}
                  </span>
                  <span className="text-xs text-slate-400">
                    {song.musical_key ? `Key of ${song.musical_key} · ` : ""}
                    {new Date(song.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
