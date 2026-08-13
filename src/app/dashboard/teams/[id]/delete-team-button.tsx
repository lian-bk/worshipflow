"use client";

import { useTransition } from "react";
import { deleteTeam } from "../actions";

export function DeleteTeamButton({ teamId }: { teamId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm("Delete this team? Its members list and any positions will be removed too."))
          return;
        startTransition(() => {
          deleteTeam(teamId);
        });
      }}
      disabled={pending}
      className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      Delete Team
    </button>
  );
}
