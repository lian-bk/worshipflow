import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ServiceItemList } from "./service-item-list";

export default async function PlanServicePage({
  params,
}: {
  params: Promise<{ occurrenceId: string }>;
}) {
  const { occurrenceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("church_id, is_church_admin").eq("id", user.id).single()
    : { data: null };
  if (!profile?.church_id) notFound();

  if (!profile.is_church_admin) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Plan Service</h1>
        <p className="mt-2 text-sm text-slate-500">Only your church&rsquo;s Admin can plan services.</p>
      </div>
    );
  }

  const { data: occurrence } = await supabase
    .from("service_occurrences")
    .select("id, date, note, service_type_id")
    .eq("id", occurrenceId)
    .single();
  if (!occurrence) notFound();

  const { data: serviceType } = occurrence.service_type_id
    ? await supabase.from("service_types").select("name").eq("id", occurrence.service_type_id).single()
    : { data: null };

  const [{ data: items }, { data: songs }, { data: arrangements }, { data: mediaAssets }] = await Promise.all([
    supabase
      .from("service_items")
      .select("id, title, item_type, song_id, arrangement_id, media_asset_id, display_order")
      .eq("service_occurrence_id", occurrenceId)
      .order("display_order"),
    supabase.from("songs").select("id, title").eq("church_id", profile.church_id).order("title"),
    supabase.from("arrangements").select("id, name, song_id"),
    supabase.from("media_assets").select("id, name, kind").eq("church_id", profile.church_id).order("name"),
  ]);

  const songTitleById = new Map((songs ?? []).map((s) => [s.id, s.title]));
  const arrangementOptions = (arrangements ?? [])
    .filter((a) => songTitleById.has(a.song_id))
    .map((a) => ({ id: a.id, label: `${songTitleById.get(a.song_id)} — ${a.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div>
      <p className="mb-2">
        <Link href="/dashboard/planner" className="text-sm text-slate-500 underline">
          ← Service Planner
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">
          {serviceType?.name || "Service"} —{" "}
          {new Date(occurrence.date + "T00:00:00").toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h1>
        <Link
          href={`/dashboard/show/${occurrenceId}`}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Run Live Show →
        </Link>
      </div>
      {occurrence.note && <p className="mt-1 text-sm text-slate-500">{occurrence.note}</p>}

      <div className="mt-6">
        <ServiceItemList
          occurrenceId={occurrenceId}
          items={items ?? []}
          songs={songs ?? []}
          arrangementOptions={arrangementOptions}
          mediaAssets={mediaAssets ?? []}
        />
      </div>
    </div>
  );
}
