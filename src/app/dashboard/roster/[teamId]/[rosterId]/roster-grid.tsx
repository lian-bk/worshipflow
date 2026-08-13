"use client";

import { useState, useTransition } from "react";
import {
  assignPerson,
  checkConflicts,
  setNote as saveNote,
  addExtraDate,
  removeExtraDate,
} from "../../actions";

type Position = { id: string; label: string; display_order: number };
type Member = { id: string; name: string };
type SectionOccurrence = { id: string; date: string; note: string | null };
type Section = { serviceTypeId: string; serviceTypeName: string; occurrences: SectionOccurrence[] };
type ExtraDate = { id: string; date: string; note: string | null };
type CellAssignment = { userId: string; response: string };

function formatDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function RosterGrid({
  rosterId,
  teamId,
  canManage,
  positions,
  members,
  sections,
  extraDates,
  notesByOccurrence,
  assignmentByCell,
}: {
  rosterId: string;
  teamId: string;
  canManage: boolean;
  positions: Position[];
  members: Member[];
  sections: Section[];
  extraDates: ExtraDate[];
  notesByOccurrence: Record<string, string>;
  assignmentByCell: Record<string, CellAssignment>;
}) {
  return (
    <div className="flex flex-col gap-8">
      {sections.length === 0 && extraDates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          No dates yet this month — add a weekly Service Type on the Service Types page, or add a one-off date
          below.
        </p>
      ) : (
        sections.map((section) => (
          <div key={section.serviceTypeId}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {section.serviceTypeName}
            </h2>
            <RosterTable
              rosterId={rosterId}
              teamId={teamId}
              canManage={canManage}
              positions={positions}
              members={members}
              rows={section.occurrences.map((occ) => ({
                occurrenceId: occ.id,
                date: occ.date,
                globalNote: occ.note,
                teamNote: notesByOccurrence[occ.id] ?? "",
                isPrivate: false,
              }))}
              assignmentByCell={assignmentByCell}
            />
          </div>
        ))
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Extra dates
        </h2>
        {extraDates.length > 0 && (
          <RosterTable
            rosterId={rosterId}
            teamId={teamId}
            canManage={canManage}
            positions={positions}
            members={members}
            rows={extraDates.map((d) => ({
              occurrenceId: d.id,
              date: d.date,
              globalNote: null,
              teamNote: d.note ?? "",
              isPrivate: true,
            }))}
            assignmentByCell={assignmentByCell}
            onRemove={canManage ? (occId) => removeExtraDate(rosterId, occId) : undefined}
          />
        )}
        {canManage && <AddExtraDateForm rosterId={rosterId} />}
      </div>
    </div>
  );
}

type Row = {
  occurrenceId: string;
  date: string;
  globalNote: string | null;
  teamNote: string;
  isPrivate: boolean;
};

function RosterTable({
  rosterId,
  teamId,
  canManage,
  positions,
  members,
  rows,
  assignmentByCell,
  onRemove,
}: {
  rosterId: string;
  teamId: string;
  canManage: boolean;
  positions: Position[];
  members: Member[];
  rows: Row[];
  assignmentByCell: Record<string, CellAssignment>;
  onRemove?: (occurrenceId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Note</th>
            {positions.map((p) => (
              <th key={p.id} className="px-3 py-2">
                {p.label}
              </th>
            ))}
            {onRemove && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.occurrenceId}>
              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">{formatDate(row.date)}</td>
              <td className="px-3 py-2">
                <NoteCell rosterId={rosterId} occurrenceId={row.occurrenceId} globalNote={row.globalNote} teamNote={row.teamNote} canManage={canManage} />
              </td>
              {positions.map((p) => (
                <td key={p.id} className="px-3 py-2">
                  <AssignCell
                    rosterId={rosterId}
                    teamId={teamId}
                    occurrenceId={row.occurrenceId}
                    positionId={p.id}
                    members={members}
                    canManage={canManage}
                    assignment={assignmentByCell[`${row.occurrenceId}:${p.id}`]}
                  />
                </td>
              ))}
              {onRemove && (
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Remove this date?")) onRemove(row.occurrenceId);
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignCell({
  rosterId,
  teamId,
  occurrenceId,
  positionId,
  members,
  canManage,
  assignment,
}: {
  rosterId: string;
  teamId: string;
  occurrenceId: string;
  positionId: string;
  members: Member[];
  canManage: boolean;
  assignment?: CellAssignment;
}) {
  const [value, setValue] = useState(assignment?.userId ?? "");
  const [pending, startTransition] = useTransition();

  if (!canManage) {
    const name = members.find((m) => m.id === value)?.name;
    return <span className="text-slate-700">{name || <span className="text-slate-300">—</span>}</span>;
  }

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newVal = e.target.value;
    const prevVal = value;
    setValue(newVal);

    if (newVal) {
      const conflicts = await checkConflicts(newVal, occurrenceId, teamId);
      if (conflicts.length > 0) {
        const name = members.find((m) => m.id === newVal)?.name ?? "This person";
        const lines = conflicts.map(
          (c) => `${name} is already on the ${c.teamName} roster (${c.positionLabel}) for ${c.dateLabel}.`
        );
        if (!window.confirm(`${lines.join("\n")}\n\nAssign anyway?`)) {
          setValue(prevVal);
          return;
        }
      }
    }

    startTransition(() => {
      assignPerson(rosterId, occurrenceId, positionId, newVal || null);
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onChange={handleChange}
      className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-60"
    >
      <option value="">—</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

function NoteCell({
  rosterId,
  occurrenceId,
  globalNote,
  teamNote,
  canManage,
}: {
  rosterId: string;
  occurrenceId: string;
  globalNote: string | null;
  teamNote: string;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNoteValue] = useState(teamNote);
  const [, startTransition] = useTransition();

  function save() {
    setEditing(false);
    if (note.trim() === teamNote.trim()) return;
    startTransition(() => {
      saveNote(rosterId, occurrenceId, note);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {globalNote && <span className="text-xs font-medium text-amber-700">{globalNote}</span>}
      {canManage ? (
        editing ? (
          <input
            autoFocus
            value={note}
            onChange={(e) => setNoteValue(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Add a note…"
            className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            className={`cursor-text text-xs hover:underline ${note ? "text-slate-600" : "text-slate-300"}`}
          >
            {note || "Add note…"}
          </span>
        )
      ) : (
        note && <span className="text-xs text-slate-600">{note}</span>
      )}
    </div>
  );
}

function AddExtraDateForm({ rosterId }: { rosterId: string }) {
  const [date, setDate] = useState("");
  const [note, setNoteValue] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!date) return;
        startTransition(async () => {
          await addExtraDate(rosterId, date, note);
          setDate("");
          setNoteValue("");
        });
      }}
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNoteValue(e.target.value)}
        placeholder="Note (optional), e.g. Crusade night 1"
        className="w-56 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        + Add date
      </button>
    </form>
  );
}
