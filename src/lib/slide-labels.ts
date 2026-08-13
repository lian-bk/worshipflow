// Shared label metadata for song slides — one place that decides both the
// display name ("Verse 1", "Chorus") and the colour used everywhere a label
// shows up (song editor, arrangement builder), so the colour-coding always
// stays consistent across the whole app.
import type { SlideLabelType } from "./supabase/types";

export const SLIDE_LABEL_ORDER: SlideLabelType[] = [
  "verse",
  "prechorus",
  "chorus",
  "bridge",
  "intro",
  "outro",
  "tag",
  "other",
];

export const SLIDE_LABEL_NAMES: Record<SlideLabelType, string> = {
  verse: "Verse",
  prechorus: "Pre-Chorus",
  chorus: "Chorus",
  bridge: "Bridge",
  intro: "Intro",
  outro: "Outro",
  tag: "Tag",
  other: "Other",
};

// Tailwind classes per label type — light background chip + matching border,
// legible in both the editor list and the small arrangement pills.
export const SLIDE_LABEL_COLORS: Record<SlideLabelType, string> = {
  verse: "bg-blue-100 text-blue-800 border-blue-300",
  prechorus: "bg-teal-100 text-teal-800 border-teal-300",
  chorus: "bg-amber-100 text-amber-800 border-amber-300",
  bridge: "bg-purple-100 text-purple-800 border-purple-300",
  intro: "bg-slate-100 text-slate-700 border-slate-300",
  outro: "bg-rose-100 text-rose-800 border-rose-300",
  tag: "bg-indigo-100 text-indigo-800 border-indigo-300",
  other: "bg-gray-100 text-gray-700 border-gray-300",
};

export type SlideLike = {
  label_type: SlideLabelType;
  label_number: number | null;
  custom_label: string | null;
};

/** The human-readable label shown on a slide, e.g. "Verse 1", "Chorus", "Interlude". */
export function slideLabelDisplay(slide: SlideLike): string {
  if (slide.label_type === "other" && slide.custom_label) return slide.custom_label;
  const base = SLIDE_LABEL_NAMES[slide.label_type];
  if (slide.label_number) return `${base} ${slide.label_number}`;
  return base;
}
