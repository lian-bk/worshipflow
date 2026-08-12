import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/dashboard/actions";

// This is the "front door" check: anyone who isn't signed in, or is signed
// in but isn't marked is_owner in the database, gets bounced straight to
// /dashboard before any owner data is even queried — even if they type
// /owner into the address bar directly. The Server Actions in actions.ts
// each re-check this too, so guessing the URL never gets you real data.
export default async function OwnerLayout({
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
    .select("is_owner, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile?.is_owner) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
        <div>
          <p className="text-lg font-semibold text-slate-900">WorshipFlow — Owner Console</p>
          <p className="text-sm text-slate-500">{profile.full_name || profile.email}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Log Out
          </button>
        </form>
      </header>

      <main className="p-8">{children}</main>
    </div>
  );
}
