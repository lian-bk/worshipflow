"use client";

import { useEffect, useState } from "react";

// Dismissible per browser tab: once closed, it stays closed until the tab is
// closed or the trial's day count changes (a new day rebuilds the key below,
// so yesterday's dismissal doesn't hide a fresh warning).
export function TrialBanner({ daysRemaining }: { daysRemaining: number }) {
  const storageKey = `worshipflow-trial-banner-dismissed-${daysRemaining}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
      <span>
        {daysRemaining <= 0
          ? "Your trial ends today."
          : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left in your trial.`}
      </span>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(storageKey, "1");
          setDismissed(true);
        }}
        className="text-amber-700 hover:text-amber-900"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
