"use client";

import { useRef, useState, useTransition } from "react";
import { importSongs, type ImportSongInput } from "./actions";

// Bulk-imports a church's existing songbook from a JSON file — each song:
// { title, number?, key?, category?, lang?, sections: [{ label, lines }] }.
// Reads the file entirely in the browser (nothing but the parsed songs ever
// leaves this device) and hands the array to the importSongs Server Action.
export function ImportSongsForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      let parsed: ImportSongInput[];
      try {
        const data = JSON.parse(String(reader.result));
        parsed = Array.isArray(data) ? data : data.songs;
        if (!Array.isArray(parsed)) throw new Error("not an array");
      } catch {
        setError("That file isn't valid — expected a JSON list of songs (or {\"songs\": [...]}).");
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      startTransition(async () => {
        try {
          const outcome = await importSongs(parsed);
          setResult(outcome);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Import failed.");
        } finally {
          if (inputRef.current) inputRef.current.value = "";
        }
      });
    };
    reader.readAsText(file);
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm font-medium text-slate-700"
      >
        {open ? "▾" : "▸"} Import songs from a file
      </button>

      {open && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500">
            Pick a JSON file with a list of songs — each one can have a title, song number,
            musical key, category, language, and its lyrics already split into sections (e.g.{" "}
            <code className="rounded bg-slate-100 px-1">
              {`{"title": "...", "sections": [{"label": "Verse 1", "lines": ["..."]}]}`}
            </code>
            ). Categories become tags automatically.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            disabled={pending}
            className="text-sm"
          />
          {pending && <p className="mt-2 text-xs text-slate-500">Importing… this can take a few seconds for a large songbook.</p>}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          {result && (
            <p className="mt-2 text-xs text-emerald-700">
              Imported {result.imported} song{result.imported === 1 ? "" : "s"}
              {result.skipped > 0 ? `, skipped ${result.skipped}` : ""}.
              {result.errors.length > 0 && (
                <span className="mt-1 block text-amber-600">{result.errors.join(" ")}</span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
