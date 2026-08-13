"use client";

import { useState, useTransition } from "react";
import { createTag, setMediaTags } from "../actions";
import { deleteMedia } from "./actions";
import type { MediaStorageSource, PptxConversionStatus } from "@/lib/supabase/types";

export type MediaItem = {
  id: string;
  name: string;
  kind: string | null;
  storageSource: MediaStorageSource;
  externalReference: string | null;
  pptxConversionStatus: PptxConversionStatus | null;
  signedUrl: string | null;
  tags: string[];
  children: { id: string; name: string; signedUrl: string | null }[];
};

type Tag = { id: string; name: string };

export function MediaGrid({ items, allTags }: { items: MediaItem[]; allTags: Tag[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
        No media yet — upload an image/PowerPoint or reference a video above.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <MediaCard key={item.id} item={item} allTags={allTags} />
      ))}
    </div>
  );
}

function MediaCard({ item, allTags }: { item: MediaItem; allTags: Tag[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex h-32 items-center justify-center bg-slate-100">
        {item.kind === "image" && item.signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.signedUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : item.kind === "pptx" ? (
          <div className="text-center text-xs text-slate-500">
            <div className="text-2xl">📊</div>
            {item.pptxConversionStatus === "complete"
              ? `${item.children.length} slide${item.children.length === 1 ? "" : "s"}`
              : item.pptxConversionStatus === "failed"
              ? "Conversion failed"
              : "Converting…"}
          </div>
        ) : item.kind === "video" ? (
          <div className="text-center text-xs text-slate-500">
            <div className="text-2xl">🎬</div>
            {item.storageSource === "local_reference" ? "On presentation laptop" : "Video"}
          </div>
        ) : (
          <div className="text-2xl text-slate-400">📄</div>
        )}
      </div>

      {item.kind === "pptx" && item.children.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50 p-1.5">
          {item.children.map((c) => (
            <div
              key={c.id}
              className="h-10 w-16 shrink-0 overflow-hidden rounded border border-slate-200 bg-white"
            >
              {c.signedUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.signedUrl} alt={c.name} className="h-full w-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="p-3">
        <p className="truncate text-sm font-medium text-slate-900" title={item.name}>
          {item.name}
        </p>
        {item.storageSource === "local_reference" && item.externalReference && (
          <p className="mt-0.5 truncate text-xs text-slate-400" title={item.externalReference}>
            {item.externalReference}
          </p>
        )}
        <MediaTagsEditor mediaId={item.id} allTags={allTags} currentTagIds={item.tags} />
      </div>

      <button
        type="button"
        onClick={() => {
          if (!window.confirm(`Delete "${item.name}"?`)) return;
          startTransition(() => {
            deleteMedia(item.id);
          });
        }}
        disabled={pending}
        className="w-full border-t border-slate-100 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}

function MediaTagsEditor({
  mediaId,
  allTags,
  currentTagIds,
}: {
  mediaId: string;
  allTags: Tag[];
  currentTagIds: string[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(currentTagIds);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  function persist(next: string[]) {
    setSelectedIds(next);
    startTransition(() => {
      setMediaTags(mediaId, next);
    });
  }

  function toggle(tagId: string) {
    persist(
      selectedIds.includes(tagId)
        ? selectedIds.filter((id) => id !== tagId)
        : [...selectedIds, tagId]
    );
  }

  async function addNew() {
    const name = input.trim();
    if (!name) return;
    setInput("");
    const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selectedIds.includes(existing.id)) persist([...selectedIds, existing.id]);
      return;
    }
    const created = await createTag(name);
    if (created) persist([...selectedIds, created.id]);
  }

  const selectedTags = allTags.filter((t) => selectedIds.includes(t.id));
  const unselected = allTags.filter((t) => !selectedIds.includes(t.id));

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {selectedTags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          onClick={() => toggle(tag.id)}
          disabled={pending}
          className="rounded-full border border-slate-400 bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-white"
          title="Remove tag"
        >
          {tag.name} ✕
        </button>
      ))}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) toggle(e.target.value);
        }}
        className="rounded-full border border-slate-300 px-1.5 py-0.5 text-[10px]"
      >
        <option value="">+ tag</option>
        {unselected.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addNew();
          }
        }}
        placeholder="new…"
        className="w-14 rounded-full border border-slate-300 px-1.5 py-0.5 text-[10px]"
      />
    </div>
  );
}
