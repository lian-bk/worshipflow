"use client";

import { useState, useTransition } from "react";
import { SLIDE_LABEL_COLORS, slideLabelDisplay } from "@/lib/slide-labels";
import { createArrangement, updateArrangement, deleteArrangement } from "../../actions";
import type { SlideRow } from "./slide-list";

type Arrangement = { id: string; name: string };
type ArrangementItem = { id: string; arrangement_id: string; song_slide_id: string; display_order: number };

export function ArrangementBuilder({
  songId,
  slides,
  arrangements,
  arrangementItems,
}: {
  songId: string;
  slides: SlideRow[];
  arrangements: Arrangement[];
  arrangementItems: ArrangementItem[];
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const slideById = new Map(slides.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-4">
      {arrangements.map((arrangement) => {
        const items = arrangementItems
          .filter((i) => i.arrangement_id === arrangement.id)
          .sort((a, b) => a.display_order - b.display_order);

        if (editingId === arrangement.id) {
          return (
            <ArrangementEditor
              key={arrangement.id}
              songId={songId}
              slides={slides}
              arrangement={arrangement}
              initialSlideIds={items.map((i) => i.song_slide_id)}
              onDone={() => setEditingId(null)}
            />
          );
        }

        return (
          <div key={arrangement.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">{arrangement.name}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(arrangement.id)}
                  className="text-xs font-medium text-slate-600 hover:underline"
                >
                  Edit
                </button>
                <DeleteArrangementButton arrangementId={arrangement.id} songId={songId} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.length === 0 && <span className="text-xs text-slate-400">No slides in this arrangement.</span>}
              {items.map((item, idx) => {
                const slide = slideById.get(item.song_slide_id);
                if (!slide) return null;
                return (
                  <span
                    key={item.id + idx}
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${SLIDE_LABEL_COLORS[slide.label_type]}`}
                  >
                    {slideLabelDisplay(slide)}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}

      {editingId === "new" ? (
        <ArrangementEditor
          songId={songId}
          slides={slides}
          arrangement={null}
          initialSlideIds={[]}
          onDone={() => setEditingId(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingId("new")}
          disabled={slides.length === 0}
          className="self-start rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          + New Arrangement
        </button>
      )}
    </div>
  );
}

function DeleteArrangementButton({ arrangementId, songId }: { arrangementId: string; songId: string }) {
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm("Delete this arrangement?")) return;
        startTransition(() => {
          deleteArrangement(arrangementId, songId);
        });
      }}
      className="text-xs font-medium text-red-600 hover:underline"
    >
      Delete
    </button>
  );
}

function ArrangementEditor({
  songId,
  slides,
  arrangement,
  initialSlideIds,
  onDone,
}: {
  songId: string;
  slides: SlideRow[];
  arrangement: Arrangement | null;
  initialSlideIds: string[];
  onDone: () => void;
}) {
  const [name, setName] = useState(arrangement?.name ?? "");
  const [picked, setPicked] = useState<string[]>(initialSlideIds);
  const [pending, startTransition] = useTransition();
  const slideById = new Map(slides.map((s) => [s.id, s]));

  function move(index: number, delta: number) {
    const next = [...picked];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPicked(next);
  }

  function remove(index: number) {
    setPicked(picked.filter((_, i) => i !== index));
  }

  function save() {
    if (!name.trim()) return;
    startTransition(async () => {
      if (arrangement) {
        await updateArrangement(arrangement.id, songId, name.trim(), picked);
      } else {
        await createArrangement(songId, name.trim(), picked);
      }
      onDone();
    });
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Arrangement name, e.g. Sunday Set"
        className="mb-3 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />

      <p className="mb-1 text-xs font-medium text-slate-600">Tap slides below to add them, in order:</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {slides.map((slide) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setPicked([...picked, slide.id])}
            className={`rounded-full border px-2 py-0.5 text-xs font-medium hover:opacity-80 ${SLIDE_LABEL_COLORS[slide.label_type]}`}
          >
            + {slideLabelDisplay(slide)}
          </button>
        ))}
      </div>

      <p className="mb-1 text-xs font-medium text-slate-600">Order:</p>
      <ol className="mb-3 flex flex-col gap-1">
        {picked.length === 0 && <li className="text-xs text-slate-400">Nothing added yet.</li>}
        {picked.map((slideId, idx) => {
          const slide = slideById.get(slideId);
          if (!slide) return null;
          return (
            <li key={idx} className="flex items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${SLIDE_LABEL_COLORS[slide.label_type]}`}>
                {idx + 1}. {slideLabelDisplay(slide)}
              </span>
              <button type="button" onClick={() => move(idx, -1)} className="text-xs text-slate-500 hover:text-slate-900">
                ↑
              </button>
              <button type="button" onClick={() => move(idx, 1)} className="text-xs text-slate-500 hover:text-slate-900">
                ↓
              </button>
              <button type="button" onClick={() => remove(idx)} className="text-xs text-red-600 hover:underline">
                Remove
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !name.trim()}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
