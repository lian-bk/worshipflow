"use client";

import { useTransition } from "react";
import { updateSongTheme } from "../../actions";

type Theme = {
  id: string;
  name: string;
  background_color: string;
  text_color: string;
  is_starter: boolean;
};

export function ThemePicker({
  songId,
  themes,
  currentThemeId,
}: {
  songId: string;
  themes: Theme[];
  currentThemeId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="theme" className="text-sm font-medium text-slate-600">
        Theme
      </label>
      <select
        id="theme"
        defaultValue={currentThemeId ?? ""}
        disabled={pending}
        onChange={(e) => {
          const value = e.target.value || null;
          startTransition(() => {
            updateSongTheme(songId, value);
          });
        }}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">No theme</option>
        {themes.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
            {theme.is_starter ? "" : " (custom)"}
          </option>
        ))}
      </select>
    </div>
  );
}
