"use client";

import { useState, useTransition } from "react";
import {
  addExistingPersonToTeam,
  addNoLoginPersonToTeam,
  inviteNewPersonToTeam,
  removeMember,
  updateMemberRole,
} from "../actions";
import type { TeamRole } from "@/lib/supabase/types";

type Member = {
  id: string;
  role: TeamRole;
  personId: string;
  name: string;
  email: string | null;
  accountStatus: string;
};
type Person = { id: string; name: string };

const ROLE_BADGE: Record<TeamRole, string> = {
  hotu: "bg-amber-100 text-amber-800 border-amber-300",
  bawmtu: "bg-sky-100 text-sky-800 border-sky-300",
  member: "bg-slate-100 text-slate-600 border-slate-300",
};

export function TeamManage({
  teamId,
  canManage,
  members,
  availablePeople,
  hotuLabel,
  bawmtuLabel,
}: {
  teamId: string;
  canManage: boolean;
  members: Member[];
  availablePeople: Person[];
  hotuLabel: string;
  bawmtuLabel: string;
}) {
  const roleLabel = (role: TeamRole) =>
    role === "hotu" ? hotuLabel : role === "bawmtu" ? bawmtuLabel : "Member";

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {members.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">No members yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <MemberRow key={m.id} teamId={teamId} member={m} canManage={canManage} roleLabel={roleLabel} />
            ))}
          </ul>
        )}
      </div>

      {canManage && (
        <div className="mt-6">
          <AddMemberForm
            teamId={teamId}
            availablePeople={availablePeople}
            hotuLabel={hotuLabel}
            bawmtuLabel={bawmtuLabel}
          />
        </div>
      )}
    </div>
  );
}

function MemberRow({
  teamId,
  member,
  canManage,
  roleLabel,
}: {
  teamId: string;
  member: Member;
  canManage: boolean;
  roleLabel: (role: TeamRole) => string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
      <div>
        <p className="font-medium text-slate-900">{member.name}</p>
        <p className="text-xs text-slate-400">
          {member.email || "No email"}
          {member.accountStatus === "invited" && " · invite pending"}
          {member.accountStatus === "no_login" && " · no login"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {canManage ? (
          <select
            value={member.role}
            disabled={pending}
            onChange={(e) => {
              startTransition(() => {
                updateMemberRole(teamId, member.id, e.target.value as TeamRole);
              });
            }}
            className={`rounded-full border px-2 py-1 text-xs font-medium ${ROLE_BADGE[member.role]}`}
          >
            <option value="hotu">{roleLabel("hotu")}</option>
            <option value="bawmtu">{roleLabel("bawmtu")}</option>
            <option value="member">Member</option>
          </select>
        ) : (
          <span className={`rounded-full border px-2 py-1 text-xs font-medium ${ROLE_BADGE[member.role]}`}>
            {roleLabel(member.role)}
          </span>
        )}

        {canManage && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Remove ${member.name} from this team?`)) return;
              startTransition(() => {
                removeMember(teamId, member.id);
              });
            }}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}

type Mode = "existing" | "invite" | "no-email";

function AddMemberForm({
  teamId,
  availablePeople,
  hotuLabel,
  bawmtuLabel,
}: {
  teamId: string;
  availablePeople: Person[];
  hotuLabel: string;
  bawmtuLabel: string;
}) {
  const [mode, setMode] = useState<Mode>(availablePeople.length > 0 ? "existing" : "invite");
  const [role, setRole] = useState<TeamRole>("member");
  const [selectedPerson, setSelectedPerson] = useState(availablePeople[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const tabs: { key: Mode; label: string }[] = [
    { key: "existing", label: "Add existing person" },
    { key: "invite", label: "Invite by email" },
    { key: "no-email", label: "No email? Add by name" },
  ];

  function roleOptionLabel(r: TeamRole) {
    return r === "hotu" ? hotuLabel : r === "bawmtu" ? bawmtuLabel : "Member";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);

    startTransition(async () => {
      try {
        if (mode === "existing") {
          if (!selectedPerson) throw new Error("Choose a person.");
          await addExistingPersonToTeam(teamId, selectedPerson, role);
        } else if (mode === "invite") {
          const result = await inviteNewPersonToTeam(teamId, email, role);
          if (result.warning) setWarning(result.warning);
          setEmail("");
        } else {
          await addNoLoginPersonToTeam(teamId, name, role);
          setName("");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Add a member</h2>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-100 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMode(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              mode === tab.key
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        {mode === "existing" &&
          (availablePeople.length === 0 ? (
            <p className="text-sm text-slate-400">
              Everyone in your church is already on this team.
            </p>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Person</span>
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {availablePeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ))}

        {mode === "invite" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="person@example.com"
              className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        {mode === "no-email" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Full name"
              className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Role on this team</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TeamRole)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="member">Member</option>
            <option value="hotu">{roleOptionLabel("hotu")}</option>
            <option value="bawmtu">{roleOptionLabel("bawmtu")}</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={pending || (mode === "existing" && availablePeople.length === 0)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Adding…" : mode === "invite" ? "Send Invite" : "Add"}
        </button>
      </form>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {warning && <p className="mt-3 text-xs text-amber-600">{warning}</p>}
    </div>
  );
}
