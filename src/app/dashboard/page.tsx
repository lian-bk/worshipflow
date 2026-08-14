import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("church_id, is_church_admin").eq("id", user.id).single()
    : { data: null };
  const isAdmin = !!profile?.is_church_admin;

  const { data: church } = profile?.church_id
    ? await supabase.from("churches").select("name").eq("id", profile.church_id).single()
    : { data: null };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        {church?.name ? `Welcome, ${church.name}` : "Dashboard"}
      </h1>
      <p className="mt-2 text-slate-500">You&rsquo;re logged in. Here&rsquo;s where everything lives:</p>

      {isAdmin && (
        <Link
          href="/dashboard/service"
          className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-400"
        >
          <span>
            <span className="font-semibold text-slate-900">Run a service →</span>
            <span className="mt-0.5 block text-sm text-slate-500">Set up service days, plan the running order, and present it live — all in one place.</span>
          </span>
          <span className="text-slate-300">→</span>
        </Link>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink href="/dashboard/roster" title="Roster" description="See or build who's serving on which team, by month." />
        <QuickLink href="/dashboard/my-schedule" title="My Schedule" description="Your own upcoming serving dates." />
        <QuickLink href="/dashboard/teams" title="Teams" description="Manage teams and who's on them." />
        <QuickLink href="/dashboard/library" title="Library" description="Songs, arrangements, themes, and media." />
        {isAdmin && <QuickLink href="/dashboard/people" title="People" description="Everyone at your church using WorshipFlow." />}
        <QuickLink href="/dashboard/settings" title="Settings" description="Church details and printed roster options." />
      </div>
    </div>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-400">
      <span className="font-medium text-slate-900">{title}</span>
      <span className="mt-1 block text-sm text-slate-500">{description}</span>
    </Link>
  );
}
