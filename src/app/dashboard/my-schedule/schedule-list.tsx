"use client";

import { useTransition } from "react";
import { respondToAssignment } from "../roster/actions";

export type ScheduleItem = {
  assignmentId: string;
  teamName: string;
  positionLabel: string;
  serviceTypeName: string | null;
  date: string;
  startTime: string | null;
  location: string | null;
  note: string | null;
  response: "pending" | "accepted" | "declined";
};

function formatDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const RESPONSE_BADGE: Record<ScheduleItem["response"], string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-700",
  accepted: "border-emerald-300 bg-emerald-50 text-emerald-700",
  declined: "border-red-300 bg-red-50 text-red-700",
};

export function ScheduleList({ items }: { items: ScheduleItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
        Nothing on your schedule yet — once a Hotu publishes a roster you&rsquo;re on, it&rsquo;ll show up here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <ScheduleRow key={item.assignmentId} item={item} />
      ))}
    </ul>
  );
}

function ScheduleRow({ item }: { item: ScheduleItem }) {
  const [pending, startTransition] = useTransition();

  function respond(response: "accepted" | "declined") {
    startTransition(() => {
      respondToAssignment(item.assignmentId, response);
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <p className="font-medium text-slate-900">{formatDate(item.date)}</p>
        <p className="mt-0.5 text-sm text-slate-600">
          {item.teamName} · {item.positionLabel}
          {item.serviceTypeName ? ` · ${item.serviceTypeName}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {item.startTime ? `${item.startTime}` : ""}
          {item.startTime && item.location ? " · " : ""}
          {item.location || ""}
          {item.note ? `${item.startTime || item.location ? " · " : ""}${item.note}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${RESPONSE_BADGE[item.response]}`}>
          {item.response === "pending" ? "Awaiting response" : item.response === "accepted" ? "Accepted" : "Declined"}
        </span>
        <button
          type="button"
          disabled={pending || item.response === "accepted"}
          onClick={() => respond("accepted")}
          className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={pending || item.response === "declined"}
          onClick={() => respond("declined")}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
        >
          Decline
        </button>
      </div>
    </li>
  );
}
