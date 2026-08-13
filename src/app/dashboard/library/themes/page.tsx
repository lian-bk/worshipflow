import { createClient } from "@/lib/supabase/server";
import { createTheme, deleteTheme } from "../actions";

export default async function ThemesPage() {
  const supabase = await createClient();
  const { data: themes } = await supabase
    .from("themes")
    .select("id, name, background_color, text_color, font_family, is_starter")
    .order("is_starter", { ascending: false })
    .order("name");

  const starters = (themes ?? []).filter((t) => t.is_starter);
  const custom = (themes ?? []).filter((t) => !t.is_starter);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Themes</h1>
      <p className="mt-1 text-sm text-slate-500">
        Background, font, and colour presets you can apply to any song. The starter set is
        always available; add your own below.
      </p>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Starter presets
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {starters.map((theme) => (
          <ThemeCard key={theme.id} theme={theme} />
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Your themes
      </h2>
      {custom.length === 0 ? (
        <p className="text-sm text-slate-400">No custom themes yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {custom.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} deletable />
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        New theme
      </h2>
      <form action={createTheme} className="flex max-w-md flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="e.g. Christmas"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="background_color" className="text-sm font-medium text-slate-700">
              Background
            </label>
            <input
              id="background_color"
              name="background_color"
              type="color"
              defaultValue="#0f172a"
              className="h-10 w-full rounded-lg border border-slate-300"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="text_color" className="text-sm font-medium text-slate-700">
              Text
            </label>
            <input
              id="text_color"
              name="text_color"
              type="color"
              defaultValue="#ffffff"
              className="h-10 w-full rounded-lg border border-slate-300"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="font_family" className="text-sm font-medium text-slate-700">
            Font
          </label>
          <select
            id="font_family"
            name="font_family"
            defaultValue="system"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="system">System (default)</option>
            <option value="serif">Serif</option>
            <option value="sans-serif">Sans-serif</option>
            <option value="monospace">Monospace</option>
          </select>
        </div>
        <button
          type="submit"
          className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Save Theme
        </button>
      </form>
    </div>
  );
}

function ThemeCard({
  theme,
  deletable,
}: {
  theme: { id: string; name: string; background_color: string; text_color: string; font_family: string };
  deletable?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div
        style={{
          backgroundColor: theme.background_color,
          color: theme.text_color,
          fontFamily: theme.font_family === "system" ? undefined : theme.font_family,
        }}
        className="flex h-20 items-center justify-center px-2 text-center text-sm font-medium"
      >
        {theme.name}
      </div>
      {deletable && (
        <form action={deleteTheme.bind(null, theme.id)} className="border-t border-slate-100 bg-white">
          <button type="submit" className="w-full py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
            Delete
          </button>
        </form>
      )}
    </div>
  );
}
