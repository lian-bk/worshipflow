"use client";

import { useState, useTransition } from "react";
import {
  addOccurrenceDate,
  deleteOccurrence,
  deleteServiceType,
  updateServiceType,
} from "./actions";
import type { ServiceTypePattern } from "@/lib/supabase/types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type ServiceType = {
  id: string;
  name: string;
  pattern_type: ServiceTypePattern;
  default_weekday: number | null;
  default_start_time: string | null;
  default_location: string | null;
};
type Occurrence = { id: string; date: string; note: string | null };

export function ServiceTypeCard({
  serviceType,
  occurrences,
}: {
  serviceType: ServiceType;
  occurrences: Occurrence[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <form
          action={async (formData) => {
            await updateServiceType(serviceType.id, formData);
            setEditing(false);
          }}
          className="flex flex-col gap-3"
        >
          <input
            name="name"
            defaultValue={serviceType.name}
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <fieldset className="flex gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="pattern_type" value="weekly" defaultChecked={serviceType.pattern_type === "weekly"} />{" "}
              Weekly gathering
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="pattern_type" value="dates" defaultChecked={serviceType.pattern_type === "dates"} />{" "}
              Special event (specific dates)
            </label>
          </fieldset>
          <div className="grid grid-cols-3 gap-2">
            <select
              name="default_weekday"
              defaultValue={String(serviceType.default_weekday ?? 0)}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            >
              {WEEKDAYS.map((day, i) => (
                <option key={day} value={i}>
                  {day}
                </option>
              ))}
            </select>
            <input
              name="default_start_time"
              type="time"
              defaultValue={serviceType.default_start_time ?? ""}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
            <input
              name="default_location"
              defaultValue={serviceType.default_location ?? ""}
              placeholder="Location"
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-slate-900">{serviceType.name}</p>
          {serviceType.pattern_type === "weekly" ? (
            <p className="mt-0.5 text-sm text-slate-500">
              Every {WEEKDAYS[serviceType.default_weekday ?? 0]}
              {serviceType.default_start_time ? ` at ${serviceType.default_start_time}` : ""}
              {serviceType.default_location ? ` · ${serviceType.default_location}` : ""}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-slate-500">
              Special event
              {serviceType.default_location ? ` · ${serviceType.default_location}` : ""}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete "${serviceType.name}"? This removes any dates saved under it too.`)) return;
              startTransition(() => {
                deleteServiceType(serviceType.id);
              });
            }}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {serviceType.pattern_type === "dates" && (
        <OccurrenceList serviceTypeId={serviceType.id} occurrences={occurrences} />
      )}
    </div>
  );
}

function OccurrenceList({ serviceTypeId, occurrences }: { serviceTypeId: string; occurrences: Occurrence[] }) {
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {occurrences.length === 0 ? (
        <p className="text-xs text-slate-400">No dates added yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {occurrences.map((occ) => (
            <li
              key={occ.id}
              className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
            >
              {new Date(occ.date + "T00:00:00").toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {occ.note ? ` — ${occ.note}` : ""}
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => deleteOccurrence(occ.id))}
                className="text-slate-400 hover:text-red-600"
                title="Remove date"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!date) return;
          startTransition(async () => {
            await addOccurrenceDate(serviceTypeId, date, note);
            setDate("");
            setNote("");
          });
        }}
        className="mt-2 flex flex-wrap items-center gap-2"
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
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          + Add date
        </button>
      </form>
    </div>
  );
}
