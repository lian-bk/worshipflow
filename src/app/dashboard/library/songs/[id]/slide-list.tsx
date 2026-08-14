"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SlideLabelType } from "@/lib/supabase/types";
import { SLIDE_LABEL_ORDER, SLIDE_LABEL_NAMES, SLIDE_LABEL_COLORS, slideLabelDisplay } from "@/lib/slide-labels";
import { reorderSlides, updateSlideLabel, updateSlideContent, updateSlideTextScale, addSlide, deleteSlide } from "../../actions";

export type SlideRow = {
  id: string;
  label_type: SlideLabelType;
  label_number: number | null;
  custom_label: string | null;
  content: string;
  display_order: number;
  text_scale: number | null;
};

export function SlideList({
  songId,
  slides,
  isFalam = false,
}: {
  songId: string;
  slides: SlideRow[];
  isFalam?: boolean;
}) {
  const [order, setOrder] = useState(slides.map((s) => s.id));
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const byId = new Map(slides.map((s) => [s.id, s]));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    startTransition(() => {
      reorderSlides(songId, next);
    });
  }

  function handleAdd(afterId: string) {
    const slide = byId.get(afterId);
    if (!slide) return;
    startTransition(async () => {
      await addSlide(songId, slide.display_order);
    });
  }

  if (slides.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
        No slides yet — this song has no lyrics to split, or all lines were blank.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className={`flex flex-col gap-2 ${pending ? "opacity-70" : ""}`}>
          {order.map((id) => {
            const slide = byId.get(id);
            if (!slide) return null;
            return <SlideRowItem key={id} slide={slide} onAddAfter={() => handleAdd(id)} isFalam={isFalam} />;
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SlideRowItem({
  slide,
  onAddAfter,
  isFalam,
}: {
  slide: SlideRow;
  onAddAfter: () => void;
  isFalam: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  });
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(slide.content);
  const [textScale, setTextScale] = useState(slide.text_scale !== null ? String(slide.text_scale) : "");
  const [, startTransition] = useTransition();

  function saveTextScale() {
    const trimmed = textScale.trim();
    const value = trimmed === "" ? null : Math.min(300, Math.max(25, Math.round(Number(trimmed))));
    startTransition(() => {
      updateSlideTextScale(slide.id, value);
    });
    setTextScale(value === null ? "" : String(value));
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function saveContent() {
    setEditing(false);
    startTransition(() => {
      updateSlideContent(slide.id, content);
    });
  }

  function handleDelete() {
    if (!window.confirm("Delete this slide?")) return;
    startTransition(() => {
      deleteSlide(slide.id);
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-slate-200 bg-white p-3 ${isDragging ? "shadow-lg" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab select-none px-1 text-slate-400 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          ⠿
        </button>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <LabelEditor slide={slide} />
            <label className="flex items-center gap-1 text-xs text-slate-500" title="Override this one slide's text size — leave blank to use the song's theme size.">
              Size
              <input
                type="number"
                min={25}
                max={300}
                step={5}
                placeholder="Theme"
                value={textScale}
                onChange={(e) => setTextScale(e.target.value)}
                onBlur={saveTextScale}
                className="w-16 rounded-md border border-slate-300 px-1.5 py-0.5 text-xs"
              />
              %
            </label>
          </div>
          {editing ? (
            <textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={saveContent}
              rows={Math.max(2, content.split("\n").length)}
              className={`mt-2 w-full rounded-md border border-slate-300 p-2 text-sm leading-relaxed ${
                isFalam ? "falam-text" : "font-mono"
              }`}
            />
          ) : (
            <p
              onClick={() => setEditing(true)}
              className={`mt-2 cursor-text whitespace-pre-wrap rounded-md p-2 text-sm leading-relaxed text-slate-800 hover:bg-slate-50 ${
                isFalam ? "falam-text" : ""
              }`}
              title="Click to edit"
            >
              {content || <span className="text-slate-400">(empty — click to add lyrics)</span>}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onAddAfter}
            title="Add slide after this one"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            + Slide
          </button>
          <button
            type="button"
            onClick={handleDelete}
            title="Delete this slide"
            className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

function LabelEditor({ slide }: { slide: SlideRow }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function apply(labelType: SlideLabelType, labelNumber: number | null, customLabel: string | null) {
    setOpen(false);
    startTransition(() => {
      updateSlideLabel(slide.id, labelType, labelNumber, customLabel);
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${SLIDE_LABEL_COLORS[slide.label_type]}`}
      >
        {slideLabelDisplay(slide)} ▾
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          {SLIDE_LABEL_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                if (type === "other") {
                  const custom = window.prompt("Custom label (e.g. Interlude):", slide.custom_label ?? "");
                  apply("other", null, custom?.trim() || null);
                } else {
                  const numStr = window.prompt(
                    `Number for this ${SLIDE_LABEL_NAMES[type]} (leave blank for none):`,
                    slide.label_type === type && slide.label_number ? String(slide.label_number) : ""
                  );
                  if (numStr === null) return;
                  const num = numStr.trim() ? parseInt(numStr.trim(), 10) : null;
                  apply(type, Number.isNaN(num) ? null : num, null);
                }
              }}
              className={`mb-1 block w-full rounded-md px-2 py-1 text-left text-xs font-medium hover:opacity-80 ${SLIDE_LABEL_COLORS[type]}`}
            >
              {SLIDE_LABEL_NAMES[type]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
