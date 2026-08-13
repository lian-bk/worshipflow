"use client";

import { useState, useTransition } from "react";
import { createTag, setSongTags } from "../../actions";

type Tag = { id: string; name: string };

export function SongTagsEditor({
  songId,
  allTags,
  currentTags,
}: {
  songId: string;
  allTags: Tag[];
  currentTags: Tag[];
}) {
  const [selected, setSelected] = useState<Tag[]>(currentTags);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  function persist(next: Tag[]) {
    setSelected(next);
    startTransition(() => {
      setSongTags(songId, next.map((t) => t.id));
    });
  }

  function toggleExisting(tag: Tag) {
    const has = selected.some((t) => t.id === tag.id);
    persist(has ? selected.filter((t) => t.id !== tag.id) : [...selected, tag]);
  }

  async function addNew() {
    const name = input.trim();
    if (!name) return;
    setInput("");
    const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selected.some((t) => t.id === existing.id)) persist([...selected, existing]);
      return;
    }
    const created = await createTag(name);
    if (created) persist([...selected, created]);
  }

  const unselected = allTags.filter((t) => !selected.some((s) => s.id === t.id));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-slate-600">Tags</span>
      {selected.map((tag) => (
        <button
          key={tag.id}
          type="button"
          onClick={() => toggleExisting(tag)}
          disabled={pending}
          className="rounded-full border border-slate-400 bg-slate-800 px-2 py-0.5 text-xs font-medium text-white"
          title="Remove tag"
        >
          {tag.name} ✕
        </button>
      ))}

      <select
        value=""
        onChange={(e) => {
          const tag = unselected.find((t) => t.id === e.target.value);
          if (tag) toggleExisting(tag);
        }}
        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
      >
        <option value="">+ Add existing…</option>
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
        placeholder="New tag…"
        className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"
      />
    </div>
  );
}
