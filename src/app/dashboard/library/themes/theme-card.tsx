"use client";

import { useState, useTransition } from "react";
import { updateTheme, deleteTheme } from "../actions";

export type MediaImageOption = { path: string; name: string };

const H_ALIGNS = ["left", "center", "right"] as const;
const V_ALIGNS = ["top", "middle", "bottom"] as const;
const JUSTIFY: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };
const ALIGN_ITEMS: Record<string, string> = { top: "flex-start", middle: "center", bottom: "flex-end" };
const TEXT_SCALE_LABEL: Record<string, string> = { small: "S", medium: "M", large: "L", xlarge: "XL" };

export function ThemeCard({
  theme,
  mediaOptions,
  deletable,
}: {
  theme: {
    id: string;
    name: string;
    background_color: string;
    text_color: string;
    font_family: string;
    background_image_path: string | null;
    text_h_align: string;
    text_v_align: string;
    text_scale?: string;
    backgroundImageUrl?: string;
  };
  mediaOptions: MediaImageOption[];
  deletable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [hAlign, setHAlign] = useState(theme.text_h_align);
  const [vAlign, setVAlign] = useState(theme.text_v_align);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div
        style={{
          backgroundColor: theme.background_color,
          backgroundImage: theme.backgroundImageUrl ? `url(${theme.backgroundImageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: theme.text_color,
          fontFamily: theme.font_family === "system" ? undefined : theme.font_family,
          textShadow: theme.backgroundImageUrl ? "0 1px 6px rgba(0,0,0,0.85)" : undefined,
          justifyContent: JUSTIFY[theme.text_h_align] ?? "center",
          alignItems: ALIGN_ITEMS[theme.text_v_align] ?? "center",
        }}
        className="relative flex h-20 px-2 py-1 text-center text-sm font-medium"
      >
        {theme.name}
        {theme.text_scale && theme.text_scale !== "medium" && (
          <span
            className="absolute right-1 top-1 rounded bg-black/40 px-1 text-[10px] font-semibold leading-tight"
            title={`Text size: ${theme.text_scale}`}
          >
            {TEXT_SCALE_LABEL[theme.text_scale] ?? ""}
          </span>
        )}
      </div>

      {deletable && !editing && (
        <div className="flex border-t border-slate-100 bg-white">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-1/2 border-r border-slate-100 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Edit
          </button>
          <form
            action={() =>
              startTransition(async () => {
                await deleteTheme(theme.id);
              })
            }
            className="w-1/2"
          >
            <button type="submit" disabled={pending} className="w-full py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
              Delete
            </button>
          </form>
        </div>
      )}

      {deletable && editing && (
        <form
          action={(formData) =>
            startTransition(async () => {
              await updateTheme(theme.id, formData);
              setEditing(false);
            })
          }
          className="flex flex-col gap-2 border-t border-slate-100 bg-white p-3"
        >
          <input
            name="name"
            defaultValue={theme.name}
            required
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <input name="background_color" type="color" defaultValue={theme.background_color} className="h-8 w-full rounded-lg border border-slate-300" title="Background color" />
            <input name="text_color" type="color" defaultValue={theme.text_color} className="h-8 w-full rounded-lg border border-slate-300" title="Text color" />
          </div>
          <select name="font_family" defaultValue={theme.font_family} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            <option value="system">System (default)</option>
            <option value="serif">Serif</option>
            <option value="sans-serif">Sans-serif</option>
            <option value="monospace">Monospace</option>
          </select>
          <select name="background_image_path" defaultValue={theme.background_image_path ?? ""} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">No background photo — use the color above</option>
            {mediaOptions.map((m) => (
              <option key={m.path} value={m.path}>
                {m.name}
              </option>
            ))}
          </select>
          {mediaOptions.length === 0 && (
            <p className="text-xs text-slate-400">No photos uploaded yet — add one in Library → Media, then come back to pick it here.</p>
          )}

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-500">Text position</span>
            <input type="hidden" name="text_h_align" value={hAlign} />
            <input type="hidden" name="text_v_align" value={vAlign} />
            <div className="grid w-fit grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {V_ALIGNS.map((v) =>
                H_ALIGNS.map((h) => {
                  const active = h === hAlign && v === vAlign;
                  return (
                    <button
                      key={`${h}-${v}`}
                      type="button"
                      onClick={() => {
                        setHAlign(h);
                        setVAlign(v);
                      }}
                      title={`${v}, ${h}`}
                      className={`h-6 w-9 rounded ${active ? "bg-slate-900" : "bg-white hover:bg-slate-200"} border border-slate-300`}
                    />
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label htmlFor={`text_scale-${theme.id}`} className="mb-1 block text-xs font-medium text-slate-500">
              Text size
            </label>
            <select
              id={`text_scale-${theme.id}`}
              name="text_scale"
              defaultValue={theme.text_scale ?? "medium"}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="small">Small</option>
              <option value="medium">Medium (default)</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra large</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="flex-1 rounded-lg bg-slate-900 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
