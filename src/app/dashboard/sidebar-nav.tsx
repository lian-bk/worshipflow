"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard/teams", label: "Teams" },
  { href: "/dashboard/people", label: "People", adminOnly: true },
  { href: "/dashboard/roster", label: "Roster" },
  // "Service" covers three route trees under the hood (Service Types,
  // Service Planner, Live Show) — see also-active list below.
  { href: "/dashboard/service", label: "Service", adminOnly: true },
  { href: "/dashboard/library", label: "Library" },
  { href: "/dashboard/my-schedule", label: "My Schedule" },
  { href: "/dashboard/settings", label: "Settings" },
];

const SERVICE_ALSO_ACTIVE = ["/dashboard/service-types", "/dashboard/planner", "/dashboard/show"];

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const visibleLinks = links.filter((link) => !link.adminOnly || isAdmin);

  return (
    <nav className="flex flex-col gap-1">
      {visibleLinks.map((link) => {
        const active =
          pathname.startsWith(link.href) ||
          (link.href === "/dashboard/service" && SERVICE_ALSO_ACTIVE.some((p) => pathname.startsWith(p)));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
