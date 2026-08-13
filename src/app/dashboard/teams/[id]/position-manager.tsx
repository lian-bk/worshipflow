"use client";

import { useState, useTransition } from "react";
import { addPosition, renamePosition, deletePosition, movePosition } from "../actions";

export type Position = { id: string; label: string; display_order: number };

// Lets a Hotu define their own roster columns, in their own language — e.g.
// LEADER | BACKUP 1 | BACKUP 2 for a song-leading team, or
// LEAD | BASS | DRUM | AC | PIANO for a musician team. These become the
// column headers on this team's Roster grid.
export function PositionManager({
  teamId,
  canManage,
  positions,
}: {
  teamId: string;
  canManage: boolean;
  positions: Position[];
}) {
  const [pending, startTransition] = useTransition();
  const [newLabel, setNewLabel] = useState("");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Roster columns</h2>
      <p className="mb-3 text-xs text-slate-500">
        The positions this team&rsquo;s roster tracks, in order — e.g. LEADER, BACKUP 1, BACKUP 2.
      </p>

      {positions.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">No columns yet — add this team&rsquo;s first position below.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5">
          {positions.map((p, idx) => (
            <PositionRow
              key={p.id}
              teamId={teamId}
              position={p}
              canManage={canManage}
              isFirst={idx === 0}
              isLast={idx === positions.length - 1}
            />
          ))}
        </ul>
      )}

      {canManage && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newLabel.trim()) return;
            startTransition(async () => {
              await addPosition(teamId, newLabel);
              setNewLabel("");
            });
          }}
          className="flex items-center gap-2"
        >
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="New column, e.g. DRUM"
            className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending || !newLabel.trim()}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            + Add column
          </button>
        </form>
      )}
    </div>
  );
}

function PositionRow({
  teamId,
  position,
  canManage,
  isFirst,
  isLast,
}: {
  teamId: string;
  position: Position;
  canManage: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(position.label);
  const [pending, startTransition] = useTransition();

  function save() {
    setEditing(false);
    if (!label.trim() || label.trim() === position.label) {
      setLabel(position.label);
      return;
    }
    startTransition(() => {
      renamePosition(teamId, position.id, label);
    });
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5">
      {editing ? (
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      ) : (
        <span
          onClick={() => canManage && setEditing(true)}
          className={`text-sm font-medium text-slate-800 ${canManage ? "cursor-text hover:underline" : ""}`}
        >
          {position.label}
        </span>
      )}

      {canManage && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pending || isFirst}
            onClick={() => startTransition(() => movePosition(teamId, position.id, "up"))}
            className="rounded px-1.5 text-xs text-slate-500 hover:text-slate-900 disabled:opacity-30"
            title="Move left"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={pending || isLast}
            onClick={() => startTransition(() => movePosition(teamId, position.id, "down"))}
            className="rounded px-1.5 text-xs text-slate-500 hover:text-slate-900 disabled:opacity-30"
            title="Move right"
          >
            ↓
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Remove the "${position.label}" column? Any assignments in it will be removed too.`)) return;
              startTransition(() => deletePosition(teamId, position.id));
            }}
            className="rounded px-1.5 text-xs text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      )}
    </li>
  );
}
