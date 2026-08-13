"use client";

import { useState } from "react";

const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "Blue", value: "#1d4ed8" },
  { label: "Green", value: "#15803d" },
  { label: "Purple", value: "#7e22ce" },
  { label: "Red", value: "#b91c1c" },
  { label: "Teal", value: "#0f766e" },
  { label: "Slate", value: "#334155" },
];

// Lets the Hotu pick a colour theme before downloading — the roster's
// content and layout stay the same, only the accent colour on the header
// bar, section rows, and note text changes. Nothing here is saved; each
// export just reflects whatever's picked at that moment.
export function ExportControls({ exportBaseUrl }: { exportBaseUrl: string }) {
  const [color, setColor] = useState(COLOR_PRESETS[0].value);

  const previewUrl = `${exportBaseUrl}?format=png&color=${encodeURIComponent(color)}`;
  const pdfUrl = `${exportBaseUrl}?format=pdf&color=${encodeURIComponent(color)}`;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        Colour
        <select
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          {COLOR_PRESETS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <a
        href={previewUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Preview / Save Image
      </a>
      <a
        href={pdfUrl}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Download PDF
      </a>
    </div>
  );
}
