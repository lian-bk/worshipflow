// Splits a block of pasted lyrics into labeled slides, the way ProPresenter's
// "slide groups" work. Fully Unicode-safe by construction — this is plain
// string splitting/trimming, so it never assumes Latin-only text and works
// the same for Falam Chin (or any other language) as it does for English.
import type { SlideLabelType } from "./supabase/types";

export type ParsedSlide = {
  labelType: SlideLabelType;
  labelNumber: number | null;
  customLabel: string | null;
  content: string;
};

// Matches a lone marker line like "Verse 1", "Verse", "Chorus", "Pre-Chorus",
// "Bridge", "Intro", "Outro"/"Ending", "Tag" — case-insensitive, optional
// trailing number. If the pasted lyrics already have these as section
// headers (common when copying from another lyrics source), they get
// detected and stripped automatically instead of becoming part of the slide
// text.
const MARKER_PATTERNS: { pattern: RegExp; type: SlideLabelType }[] = [
  { pattern: /^verse\s*(\d+)?$/i, type: "verse" },
  { pattern: /^pre-?chorus\s*(\d+)?$/i, type: "prechorus" },
  { pattern: /^chorus\s*(\d+)?$/i, type: "chorus" },
  { pattern: /^bridge\s*(\d+)?$/i, type: "bridge" },
  { pattern: /^intro\s*(\d+)?$/i, type: "intro" },
  { pattern: /^(outro|ending)\s*(\d+)?$/i, type: "outro" },
  { pattern: /^tag\s*(\d+)?$/i, type: "tag" },
];

function detectMarker(firstLine: string): { type: SlideLabelType; number: number | null } | null {
  const trimmed = firstLine.trim();
  for (const { pattern, type } of MARKER_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const numGroup = match[1] ?? match[2];
      return { type, number: numGroup ? parseInt(numGroup, 10) : null };
    }
  }
  return null;
}

export function splitLyricsIntoSlides(raw: string): ParsedSlide[] {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Split on one or more blank lines.
  const chunks = normalized
    .split(/\n\s*\n+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const autoCounters: Partial<Record<SlideLabelType, number>> = {};

  return chunks.map((chunk) => {
    const lines = chunk.split("\n");
    const marker = detectMarker(lines[0]);

    if (marker) {
      const content = lines.slice(1).join("\n").trim();
      let number = marker.number;
      const numberableTypes: SlideLabelType[] = ["verse", "chorus", "prechorus", "bridge"];
      if (number === null && numberableTypes.includes(marker.type)) {
        autoCounters[marker.type] = (autoCounters[marker.type] ?? 0) + 1;
        number = autoCounters[marker.type]!;
      }
      return { labelType: marker.type, labelNumber: number, customLabel: null, content };
    }

    return { labelType: "other" as SlideLabelType, labelNumber: null, customLabel: null, content: chunk };
  });
}
