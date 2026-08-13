import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Duplicated from planner/actions.ts on purpose (matches this codebase's
// pattern elsewhere): a Server Component's render can't call
// revalidatePath, so the "ensure this month's weekly dates exist" logic
// needs a version with no revalidatePath call, used automatically here on
// every page load. The action of the same shape in actions.ts is for the
// explicit "Refresh" button (e.g. after adding a new weekly Service Type
// mid-month), where a real Server Action invocation makes revalidatePath
// safe to call.
async function ensureWeeklyOccurrences(supabase: ServerClient, churchId: string, month: number, year: number) {
  const { data: serviceTypes } = await supabase
    .from("service_types")
    .select("id, pattern_type, default_weekday")
    .eq("church_id", churchId);

  const weekly = (serviceTypes ?? []).filter(
    (st) => st.pattern_type === "weekly" && st.default_weekday !== null
  );
  if (weekly.length === 0) return;

  const daysInMonth = new Date(year, month, 0).getDate();
  const rows: { service_type_id: string; date: string }[] = [];
  for (const st of weekly) {
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      if (d.getDay() === st.default_weekday) {
        rows.push({ service_type_id: st.id, date: isoDate(year, month, day) });
      }
    }
  }
  if (rows.length === 0) return;

  await supabase.from("service_occurrences").upsert(rows, { onConflict: "service_type_id,date", ignoreDuplicates: true });
}

export default async function ServicePlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = Number(params.month) || now.getMonth() + 1;
  const year = Number(params.year) || now.getFullYear();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("church_id, is_church_admin").eq("id", user.id).single()
    : { data: null };

  if (!profile?.church_id || !profile.is_church_admin) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Service Planner</h1>
        <p className="mt-2 text-sm text-slate-500">Only your church&rsquo;s Admin can plan services.</p>
      </div>
    );
  }

  await ensureWeeklyOccurrences(supabase, profile.church_id, month, year);

  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = isoDate(year, month, 1);
  const monthEnd = isoDate(year, month, daysInMonth);

  const [{ data: serviceTypes }, { data: occurrences }, { data: itemCounts }] = await Promise.all([
    supabase.from("service_types").select("id, name").eq("church_id", profile.church_id),
    supabase
      .from("service_occurrences")
      .select("id, service_type_id, date, note")
      .not("service_type_id", "is", null)
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .order("date"),
    supabase.from("service_items").select("service_occurrence_id"),
  ]);

  const serviceTypeById = new Map((serviceTypes ?? []).map((st) => [st.id, st.name]));
  const countByOccurrence = new Map<string, number>();
  for (const item of itemCounts ?? []) {
    if (!item.service_occurrence_id) continue;
    countByOccurrence.set(item.service_occurrence_id, (countByOccurrence.get(item.service_occurrence_id) ?? 0) + 1);
  }

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Service Planner</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pick a date, then build that service&rsquo;s song and item running order.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/planner?month=${prevMonth}&year=${prevYear}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            ← Prev
          </Link>
          <span className="text-sm font-semibold text-slate-900">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Link
            href={`/dashboard/planner?month=${nextMonth}&year=${nextYear}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {!occurrences || occurrences.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            No service dates this month yet — add a weekly Service Type on the Service Types
            page first, then come back here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {occurrences.map((occ) => {
              const count = countByOccurrence.get(occ.id) ?? 0;
              return (
                <li key={occ.id}>
                  <Link
                    href={`/dashboard/planner/${occ.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">
                        {new Date(occ.date + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        — {occ.service_type_id ? serviceTypeById.get(occ.service_type_id) : ""}
                      </span>
                      {occ.note && <span className="text-xs text-slate-400">{occ.note}</span>}
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      {count === 0 ? "Not planned" : `${count} item${count === 1 ? "" : "s"}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
