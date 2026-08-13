"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard/library", label: "Songs", match: (p: string) => p === "/dashboard/library" || p.startsWith("/dashboard/library/songs") },
  { href: "/dashboard/library/media", label: "Media", match: (p: string) => p.startsWith("/dashboard/library/media") },
  { href: "/dashboard/library/themes", label: "Themes", match: (p: string) => p.startsWith("/dashboard/library/themes") },
];

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 text-sm font-medium ${
                active
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
