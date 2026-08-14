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
};

export type LivePayload =
  | { type: "blank" }
  | { type: "logo"; churchName: string; tagline: string }
  | { type: "slide"; current: LiveSlide; next: LiveSlide | null };

export const BLANK_PAYLOAD: LivePayload = { type: "blank" };

export function liveChannelName(token: string) {
  return `live-show-${token}`;
}
