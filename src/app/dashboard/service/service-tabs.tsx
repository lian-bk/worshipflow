"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Shared sub-navigation shown at the top of every page in the "set up a
// service → plan it → present it" flow, so it's always obvious which step
// you're on and one click to jump to any other step — instead of hunting
// through the main sidebar for three separately-named links.
const TABS = [
  { href: "/dashboard/service", label: "Overview" },
  { href: "/dashboard/service-types", label: "1 · Service Types" },
  { href: "/dashboard/planner", label: "2 · Service Planner" },
  { href: "/dashboard/show", label: "3 · Live Show" },
];

export function ServiceTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 pb-2">
      {TABS.map((tab) => {
        const active = tab.href === "/dashboard/service" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
