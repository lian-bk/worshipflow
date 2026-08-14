// Shared shape for "what's on screen right now" — written by the church
// Admin's Show page (src/app/dashboard/show/[occurrenceId]/show-view.tsx)
// into the live_show_state table and broadcast over Supabase Realtime, then
// read by the public, no-login link pages under src/app/live/[token]/*.
// Keeping this in one file means the admin side and the public side can
// never drift apart on what a payload looks like.

export type LiveSlide = {
  kind: "lyric" | "title" | "image";
  label?: string;
  content: string;
  imageUrl?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily?: string;
  // Theme's background photo (Library → Themes), shown behind lyric text —
  // separate from imageUrl, which is the whole slide for a "media" item.
  backgroundImageUrl?: string;
  // Where the text sits on screen (Library → Themes → Edit). Defaults to
  // dead-center when absent.
  textHAlign?: "left" | "center" | "right";
  textVAlign?: "top" | "middle" | "bottom";
  // Manual text size as a percentage (100 = normal) — same idea as
  // ProPresenter's number-with-up/down-arrows box. Set per theme (Library →
  // Themes → Edit) or per individual slide (Library → a song → click a
  // slide's size), which overrides the theme just for that one slide.
  // Combined with autoFitScale() below so long lyric blocks still shrink to
  // fit the screen even at a large manual size.
  textScale?: number;
};

// Turns a text-size percentage into a plain multiplier (100% -> 1).
export function scaleFromPercent(pct: number | undefined): number {
  return (pct ?? 100) / 100;
}

// Rough "shrink to fit" for long lyric blocks — without this, a long verse
// at a large text size runs off the bottom/top of the screen instead of
// getting smaller like ProPresenter's auto-shrink does. This is a simple
// length-based heuristic, not true box-measurement, but it keeps most real
// lyric blocks readable and on-screen.
export function autoFitScale(content: string): number {
  const len = (content || "").length;
  if (len > 220) return 0.55;
  if (len > 160) return 0.65;
  if (len > 110) return 0.78;
  if (len > 70) return 0.9;
  return 1;
}

export type LivePayload =
  | { type: "blank" }
  | { type: "logo"; churchName: string; tagline: string }
  | { type: "slide"; current: LiveSlide; next: LiveSlide | null };

export const BLANK_PAYLOAD: LivePayload = { type: "blank" };

export function liveChannelName(token: string) {
  return `live-show-${token}`;
}
