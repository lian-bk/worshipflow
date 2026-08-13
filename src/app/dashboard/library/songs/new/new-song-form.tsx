"use client";

import { useState } from "react";
import { createSong } from "../../actions";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "falam", label: "Falam Chin" },
  { value: "myanmar", label: "Myanmar (Burmese)" },
  { value: "other", label: "Other" },
];

export function NewSongForm() {
  const [lang, setLang] = useState("en");
  const isFalam = lang === "falam";

  return (
    <form action={createSong} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium text-slate-700">
          Song Title
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="e.g. Zangfahnak Hla"
          className={`rounded-lg border border-slate-300 px-3 py-2 text-sm ${isFalam ? "falam-text" : ""}`}
        />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="lang" className="text-sm font-medium text-slate-700">
            Language
          </label>
          <select
            id="lang"
            name="lang"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          {isFalam && (
            <p className="text-xs text-slate-400">
              Displays in the Falam lyrics font automatically, everywhere this song shows up.
            </p>
          )}
        </div>
        <div className="flex w-32 flex-col gap-1">
          <label htmlFor="musical_key" className="text-sm font-medium text-slate-700">
            Key
          </label>
          <input
            id="musical_key"
            name="musical_key"
            placeholder="e.g. G"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="lyrics" className="text-sm font-medium text-slate-700">
          Lyrics
        </label>
        <textarea
          id="lyrics"
          name="lyrics"
          rows={16}
          placeholder={"Verse 1\nFirst line of the verse...\n\nChorus\nFirst line of the chorus..."}
          className={`rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed ${
            isFalam ? "falam-text" : "font-mono"
          }`}
        />
      </div>

      <button
        type="submit"
        className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Create Song
      </button>
    </form>
  );
}
