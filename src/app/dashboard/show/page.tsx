import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Same date list as Service Planner (this month's church-wide service
// dates) — pick one here to launch its Live Show. Doesn't create dates
// itself; visit Service Planner first if this month's dates haven't been
// generated yet (that page does the "ensure this month's weekly dates
// exist" step, so it's the natural place to land first).
export default async function ShowLandingPage({
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
        <h1 className="text-2xl font-semibold text-slate-900">Live Show</h1>
        <p className="mt-2 text-sm text-slate-500">Only your church&rsquo;s Admin can run the live show.</p>
      </div>
    );
  }

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
          <h1 className="text-2xl font-semibold text-slate-900">Live Show</h1>
          <p className="mt-1 text-sm text-slate-500">Pick a date to run its live show.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/show?month=${prevMonth}&year=${prevYear}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            ← Prev
          </Link>
          <span className="text-sm font-semibold text-slate-900">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Link
            href={`/dashboard/show?month=${nextMonth}&year=${nextYear}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {!occurrences || occurrences.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            No service dates this month yet — visit Service Planner first to generate them.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {occurrences.map((occ) => {
              const count = countByOccurrence.get(occ.id) ?? 0;
              return (
                <li key={occ.id}>
                  <Link
                    href={`/dashboard/show/${occ.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">
                      {new Date(occ.date + "T00:00:00").toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      — {occ.service_type_id ? serviceTypeById.get(occ.service_type_id) : ""}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {count === 0 ? "Nothing planned" : `${count} item${count === 1 ? "" : "s"}`}
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
