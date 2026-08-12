import { createClient } from "@/lib/supabase/server";
import { daysRemaining } from "@/lib/license-keys";
import { GenerateKeyForm } from "./generate-key-form";
import { ChurchRowActions } from "./church-row-actions";
import { RunExpirationButton } from "./run-expiration-button";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const statusStyles: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  unused: "bg-slate-100 text-slate-700",
  expired: "bg-amber-100 text-amber-800",
  revoked: "bg-red-100 text-red-800",
};

export default async function OwnerPage() {
  const supabase = await createClient();

  const [{ data: churches }, { data: keys }, { data: plans }] = await Promise.all([
    supabase
      .from("churches")
      .select("id, name, contact_email, license_key_id")
      .order("name"),
    supabase
      .from("license_keys")
      .select("id, key_code, plan_code, status, activated_at, expires_at, issued_to_email"),
    supabase.from("license_plans").select("plan_code, label").order("label"),
  ]);

  const planLabel = new Map((plans ?? []).map((p) => [p.plan_code, p.label]));
  const keyById = new Map((keys ?? []).map((k) => [k.id, k]));

  const rows = (churches ?? [])
    .map((church) => {
      const key = church.license_key_id ? keyById.get(church.license_key_id) : undefined;
      return { church, key };
    })
    .filter((row) => row.key); // a church always has a key once registered, but guard anyway

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Owner Console</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage every church&apos;s license — generate keys, extend or revoke access, and see
          who&apos;s about to run out.
        </p>
      </div>

      <GenerateKeyForm plans={plans ?? []} />

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Churches</h2>
          <RunExpirationButton />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Church</th>
                <th className="py-2 pr-4">Contact Email</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Activated</th>
                <th className="py-2 pr-4">Expiry</th>
                <th className="py-2 pr-4">Days Remaining</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-slate-400">
                    No churches have registered yet. Generate a key above to get started.
                  </td>
                </tr>
              )}
              {rows.map(({ church, key }) => {
                if (!key) return null;
                const remaining = daysRemaining(key.expires_at);
                return (
                  <tr key={church.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-4 font-medium text-slate-900">{church.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{church.contact_email}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      {planLabel.get(key.plan_code) ?? key.plan_code}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          statusStyles[key.status] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {key.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{formatDate(key.activated_at)}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      {key.expires_at ? formatDate(key.expires_at) : "Lifetime"}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {remaining === null ? "Lifetime" : `${remaining} day${remaining === 1 ? "" : "s"}`}
                    </td>
                    <td className="py-3">
                      <ChurchRowActions keyId={key.id} status={key.status} planCode={key.plan_code} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
