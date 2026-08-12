import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "./sidebar-nav";
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

  let churchName: string | null = null;
  if (profile?.church_id) {
    const { data: church } = await supabase
      .from("churches")
      .select("name")
      .eq("id", profile.church_id)
      .single();
    churchName = church?.name ?? null;
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

        <SidebarNav />

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

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
