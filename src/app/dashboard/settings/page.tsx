import { createClient } from "@/lib/supabase/server";
import { updateRoleLabels, updateRosterExportSettings } from "./actions";
import { SeedTeamsButton } from "./seed-teams-button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("church_id, is_church_admin").eq("id", user.id).single()
    : { data: null };

  const { data: church } = profile?.church_id
    ? await supabase
        .from("churches")
        .select("hotu_label, bawmtu_label, tagline, roster_footer_text")
        .eq("id", profile.church_id)
        .single()
    : { data: null };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>

      {profile?.is_church_admin ? (
        <>
        <div className="mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Team role names</h2>
          <p className="mt-1 text-sm text-slate-500">
            Every team has a leader and an assistant leader. Call them whatever your church
            calls them — this changes the labels everywhere in the app, for every team.
          </p>
          <form action={updateRoleLabels} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Team leader (default: Hotu)</span>
              <input
                name="hotu_label"
                defaultValue={church?.hotu_label || "Hotu"}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">
                Assistant leader (default: Bawmtu)
              </span>
              <input
                name="bawmtu_label"
                defaultValue={church?.bawmtu_label || "Bawmtu"}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Save
            </button>
          </form>
        </div>

        <div className="mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Printed roster sheet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Shown on every roster you export as a PDF or image — the tagline sits under your
            church name at the top, and the footer text goes at the very bottom (service
            times/locations work well here).
          </p>
          <form action={updateRosterExportSettings} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Tagline (optional)</span>
              <input
                name="tagline"
                defaultValue={church?.tagline || ""}
                placeholder="e.g. Falam Christian Church"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Footer text (optional)</span>
              <input
                name="roster_footer_text"
                defaultValue={church?.roster_footer_text || ""}
                placeholder="e.g. Sunday Khawm: 9:00-10:15am (Shalom Hall)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Save
            </button>
          </form>
        </div>

        <SeedTeamsButton />
        </>
      ) : (
        <p className="mt-2 text-slate-500">More settings will live here in a later phase.</p>
      )}
    </div>
  );
}
