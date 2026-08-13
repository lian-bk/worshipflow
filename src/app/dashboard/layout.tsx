import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChurchLicenseInfo, getOwnerContactEmail } from "@/lib/church-license";
import { SidebarNav } from "./sidebar-nav";
import { TrialBanner } from "./trial-banner";
import { signOut } from "./actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, is_owner, is_church_admin, church_id")
    .eq("id", user.id)
    .single();

  // The Owner account has no church of its own — send it straight to the
  // Owner Console instead of showing an empty church dashboard.
  if (profile?.is_owner) {
    redirect("/owner");
  }

  let churchName: string | null = null;
  if (profile?.church_id) {
    const { data: church } = await supabase
      .from("churches")
      .select("name")
      .eq("id", profile.church_id)
      .single();
    churchName = church?.name ?? null;
  }

  // Church accounts (never the Owner, who has no church_id) get checked
  // against their license on every page load — live, not just once a day —
  // so a revoke or expiry takes effect on the very next click, not just
  // after the nightly cron job runs.
  let showTrialBanner = false;
  let trialDaysRemaining = 0;

  if (profile?.church_id && !profile.is_owner) {
    const license = await getChurchLicenseInfo(profile.church_id);
    if (!license || license.locked) {
      const ownerEmail = await getOwnerContactEmail();
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
          <p className="text-lg font-semibold text-slate-900">
            Your WorshipFlow access has ended
          </p>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Contact {ownerEmail} to renew. Your church&apos;s data is safe and will be right
            here as soon as access is restored.
          </p>
          <form action={signOut} className="mt-6">
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Log Out
            </button>
          </form>
        </div>
      );
    }

    // Trial banner shows only to that church's Admin, per the Phase 2 spec.
    if (license.isTrial && profile.is_church_admin && license.daysRemaining !== null) {
      showTrialBanner = true;
      trialDaysRemaining = license.daysRemaining;
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white p-4">
        <div className="mb-6 px-2">
          <p className="text-lg font-semibold text-slate-900">WorshipFlow</p>
          <p className="truncate text-sm text-slate-500">
            {profile?.is_owner ? "App Owner" : churchName ?? "Your Church"}
          </p>
        </div>

        <SidebarNav isAdmin={profile?.is_church_admin ?? false} />

        <div className="mt-auto space-y-2 border-t border-slate-200 pt-4">
          <p className="truncate px-2 text-xs text-slate-500">
            {profile?.full_name || profile?.email}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Log Out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {showTrialBanner && <TrialBanner daysRemaining={trialDaysRemaining} />}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
