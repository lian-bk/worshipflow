import { createClient } from "@/lib/supabase/server";
import { createTheme } from "../actions";
import { ThemeCard, type MediaImageOption } from "./theme-card";

export default async function ThemesPage() {
  const supabase = await createClient();
  const [{ data: themes }, { data: mediaAssets }] = await Promise.all([
    supabase
      .from("themes")
      .select(
        "id, name, background_color, text_color, font_family, background_image_path, text_h_align, text_v_align, text_scale, is_starter"
      )
      .order("is_starter", { ascending: false })
      .order("name"),
    supabase
      .from("media_assets")
      .select("name, storage_path")
      .eq("kind", "image")
      .eq("storage_source", "supabase")
      .order("name"),
  ]);

  const mediaOptions: MediaImageOption[] = (mediaAssets ?? [])
    .filter((m): m is { name: string; storage_path: string } => !!m.storage_path)
    .map((m) => ({ path: m.storage_path, name: m.name }));

  // Sign every background photo currently in use (theme cards) plus every
  // photo available to pick (the select dropdowns) in one batch.
  const paths = new Set<string>();
  for (const t of themes ?? []) if (t.background_image_path) paths.add(t.background_image_path);
  const signedUrlByPath = new Map<string, string>();
  await Promise.all(
    [...paths].map(async (path) => {
      const { data } = await supabase.storage.from("media").createSignedUrl(path, 3600);
      if (data?.signedUrl) signedUrlByPath.set(path, data.signedUrl);
    })
  );

  const withUrls = (themes ?? []).map((t) => ({
    ...t,
    backgroundImageUrl: t.background_image_path ? signedUrlByPath.get(t.background_image_path) : undefined,
  }));
  const starters = withUrls.filter((t) => t.is_starter);
  const custom = withUrls.filter((t) => !t.is_starter);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Themes</h1>
      <p className="mt-1 text-sm text-slate-500">
        Background, font, and colour presets you can apply to any song. Add a background photo to a
        theme (from your Media library) and it shows behind the lyrics wherever that theme is used.
        The starter set is always available; add your own below.
      </p>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Starter presets
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {starters.map((theme) => (
          <ThemeCard key={theme.id} theme={theme} mediaOptions={mediaOptions} />
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
            <ThemeCard key={theme.id} theme={theme} mediaOptions={mediaOptions} deletable />
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
        <div className="flex flex-col gap-1">
          <label htmlFor="background_image_path" className="text-sm font-medium text-slate-700">
            Background photo (optional)
          </label>
          <select
            id="background_image_path"
            name="background_image_path"
            defaultValue=""
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">No background photo — use the color above</option>
            {mediaOptions.map((m) => (
              <option key={m.path} value={m.path}>
                {m.name}
              </option>
            ))}
          </select>
          {mediaOptions.length === 0 && (
            <p className="text-xs text-slate-400">
              No photos uploaded yet — add one in Library → Media, then come back to pick it here.
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="text_h_align" className="text-sm font-medium text-slate-700">
              Text position (across)
            </label>
            <select id="text_h_align" name="text_h_align" defaultValue="center" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="text_v_align" className="text-sm font-medium text-slate-700">
              Text position (up/down)
            </label>
            <select id="text_v_align" name="text_v_align" defaultValue="middle" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="top">Top</option>
              <option value="middle">Middle</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="text_scale" className="text-sm font-medium text-slate-700">
            Text size
          </label>
          <select id="text_scale" name="text_scale" defaultValue="medium" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="small">Small</option>
            <option value="medium">Medium (default)</option>
            <option value="large">Large</option>
            <option value="xlarge">Extra large</option>
          </select>
          <p className="text-xs text-slate-400">Long lyric lines still shrink automatically to fit the screen, regardless of this setting.</p>
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
