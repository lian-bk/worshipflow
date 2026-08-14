import { createClient } from "@/lib/supabase/server";
import { ServiceTabs } from "../service/service-tabs";
import { createServiceType } from "./actions";
import { ServiceTypeCard } from "./service-type-card";

export default async function ServiceTypesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("church_id, is_church_admin").eq("id", user.id).single()
    : { data: null };

  if (!profile?.is_church_admin) {
    return (
      <div>
        <ServiceTabs />
        <h1 className="text-2xl font-semibold text-slate-900">Service Types</h1>
        <p className="mt-2 text-sm text-slate-500">
          Only your church&rsquo;s Admin can manage service types.
        </p>
      </div>
    );
  }

  const [{ data: serviceTypes }, { data: occurrences }] = await Promise.all([
    supabase
      .from("service_types")
      .select("id, name, pattern_type, default_weekday, default_start_time, default_location")
      .order("name"),
    supabase.from("service_occurrences").select("id, service_type_id, date, note").order("date"),
  ]);

  const occurrencesByType = new Map<string, { id: string; date: string; note: string | null }[]>();
  for (const occ of occurrences ?? []) {
    // service_occurrences.service_type_id is null for a roster's own
    // private one-off dates (Phase 5) — this page only shows the
    // church-wide, service-type-driven ones, so skip those.
    if (!occ.service_type_id) continue;
    const list = occurrencesByType.get(occ.service_type_id) ?? [];
    list.push({ id: occ.id, date: occ.date, note: occ.note });
    occurrencesByType.set(occ.service_type_id, list);
  }

  return (
    <div>
      <ServiceTabs />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Service Types</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your church&rsquo;s recurring gatherings (a normal weekday, time, and place) or
          special multi-date events (a specific list of dates) — free text, in your own
          language.
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-4">
        {!serviceTypes || serviceTypes.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            No service types yet — create one below.
          </p>
        ) : (
          serviceTypes.map((st) => (
            <ServiceTypeCard key={st.id} serviceType={st} occurrences={occurrencesByType.get(st.id) ?? []} />
          ))
        )}
      </div>

      <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">New service type</h2>
        <NewServiceTypeForm />
      </div>
    </div>
  );
}

function NewServiceTypeForm() {
  return (
    <form action={createServiceType} className="flex flex-col gap-3">
      <input
        name="name"
        required
        placeholder='e.g. "Sunday Khawm", "Nubu Khawm", "Nubu Crusade"'
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      <fieldset className="flex gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="pattern_type" value="weekly" defaultChecked /> Weekly gathering
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="pattern_type" value="dates" /> Special event (specific dates)
        </label>
      </fieldset>

      <div className="grid grid-cols-3 gap-2">
        <select name="default_weekday" defaultValue="0" className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
          <option value="0">Sunday</option>
          <option value="1">Monday</option>
          <option value="2">Tuesday</option>
          <option value="3">Wednesday</option>
          <option value="4">Thursday</option>
          <option value="5">Friday</option>
          <option value="6">Saturday</option>
        </select>
        <input
          name="default_start_time"
          type="time"
          defaultValue="09:00"
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
        />
        <input
          name="default_location"
          placeholder="Location (optional)"
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
        />
      </div>
      <p className="text-xs text-slate-400">
        Weekday/time only apply to a weekly gathering — for a special event, add its exact
        dates after creating it below.
      </p>

      <button
        type="submit"
        className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Create
      </button>
    </form>
  );
}
