"use client";

import { useRef } from "react";
import { createLocalReferenceMedia } from "./actions";

// The pluggable "no upload" storage source: for large video files a church
// keeps on their own presentation laptop instead of sending them to us. This
// just saves a label/note so it shows up in the library — nothing is
// uploaded. Architected so a future "connect Google Drive" option can be
// added as another storage source without changing this table's shape.
export function VideoReferenceForm() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createLocalReferenceMedia(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-slate-900">Reference a video</h2>
      <p className="text-xs text-slate-500">
        For video, don&rsquo;t upload it here — just note where it lives on your presentation
        laptop (e.g. a filename) so your team knows what to look for.
      </p>
      <input
        name="name"
        required
        placeholder="Video name, e.g. “Welcome Intro”"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        name="reference"
        placeholder="Where it lives, e.g. “Desktop/Videos/welcome.mp4” (optional)"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Save Reference
      </button>
    </form>
  );
}
