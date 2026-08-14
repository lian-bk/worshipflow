import Link from "next/link";
import { ServiceTabs } from "./service-tabs";

const STEPS = [
  {
    number: 1,
    title: "Service Types",
    href: "/dashboard/service-types",
    when: "Set up once",
    description:
      "Tell WorshipFlow which services you run (e.g. \"Sunday Khawm\") and when — weekly on a certain day, or specific one-off dates. This creates the calendar dates everything else uses.",
  },
  {
    number: 2,
    title: "Service Planner",
    href: "/dashboard/planner",
    when: "Repeat every week",
    description:
      "Pick a date and build that service's running order — which songs, in which arrangement, plus media or custom items (announcements, sermon title, etc.), in the order they'll happen.",
  },
  {
    number: 3,
    title: "Live Show",
    href: "/dashboard/show",
    when: "Repeat every week",
    description:
      "Pick that same date and run the actual presentation — click through slides, send them to a projector, and share live links so musicians and streaming can follow along.",
  },
];

export default function ServiceHubPage() {
  return (
    <div>
      <ServiceTabs />
      <h1 className="text-2xl font-semibold text-slate-900">Service</h1>
      <p className="mt-1 text-sm text-slate-500">
        Three steps, in order. Steps 1 is a one-time setup — steps 2 and 3 you&rsquo;ll repeat every week.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {STEPS.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-400"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {step.number}
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{step.title}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {step.when}
                </span>
              </span>
              <span className="mt-1 block text-sm text-slate-500">{step.description}</span>
            </span>
            <span className="mt-2 text-slate-300">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
