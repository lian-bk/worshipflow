"use client";

import { useTransition } from "react";
import {
  addSongItem,
  addMediaItem,
  addCustomItem,
  removeServiceItem,
  moveServiceItem,
} from "../actions";

type Item = {
  id: string;
  title: string;
  item_type: string;
  song_id: string | null;
  arrangement_id: string | null;
  media_asset_id: string | null;
  display_order: number;
};
type Song = { id: string; title: string };
type ArrangementOption = { id: string; label: string };
type MediaAsset = { id: string; name: string; kind: string | null };

const TYPE_BADGE: Record<string, string> = {
  song: "border-blue-300 bg-blue-50 text-blue-700",
  media: "border-purple-300 bg-purple-50 text-purple-700",
  custom: "border-slate-300 bg-slate-50 text-slate-600",
};

export function ServiceItemList({
  occurrenceId,
  items,
  songs,
  arrangementOptions,
  mediaAssets,
}: {
  occurrenceId: string;
  items: Item[];
  songs: Song[];
  arrangementOptions: ArrangementOption[];
  mediaAssets: MediaAsset[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {items.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            Nothing planned yet — add a song, media item, or custom item below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-sm text-slate-400">{idx + 1}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${TYPE_BADGE[item.item_type] || TYPE_BADGE.custom}`}
                  >
                    {item.item_type}
                  </span>
                  <span className="font-medium text-slate-900">{item.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={pending || idx === 0}
                    onClick={() => startTransition(() => moveServiceItem(occurrenceId, item.id, "up"))}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pending || idx === items.length - 1}
                    onClick={() => startTransition(() => moveServiceItem(occurrenceId, item.id, "down"))}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransition(() => removeServiceItem(occurrenceId, item.id))}
                    className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Add a song</h2>
          <form action={addSongItem.bind(null, occurrenceId)} className="flex flex-col gap-2">
            <select name="choice" required className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value="">Choose…</option>
              {songs.length > 0 && (
                <optgroup label="Whole song (all slides)">
                  {songs.map((s) => (
                    <option key={s.id} value={`song:${s.id}`}>
                      {s.title}
                    </option>
                  ))}
                </optgroup>
              )}
              {arrangementOptions.length > 0 && (
                <optgroup label="A specific arrangement">
                  {arrangementOptions.map((a) => (
                    <option key={a.id} value={`arr:${a.id}`}>
                      {a.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              type="submit"
              className="self-start rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Add
            </button>
          </form>
          {songs.length === 0 && (
            <p className="mt-2 text-xs text-slate-400">No songs in your Library yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Add media</h2>
          <form action={addMediaItem.bind(null, occurrenceId)} className="flex flex-col gap-2">
            <select name="media_asset_id" required className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value="">Choose…</option>
              {mediaAssets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="self-start rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Add
            </button>
          </form>
          {mediaAssets.length === 0 && (
            <p className="mt-2 text-xs text-slate-400">No media in your Library yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Add a custom item</h2>
          <form action={addCustomItem.bind(null, occurrenceId)} className="flex flex-col gap-2">
            <input
              name="title"
              required
              placeholder="e.g. Announcements, Offering, Sermon"
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
            <button
              type="submit"
              className="self-start rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Add
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
