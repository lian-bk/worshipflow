import Link from "next/link";
import { NewSongForm } from "./new-song-form";

export default function NewSongPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/library" className="text-sm text-slate-500 hover:underline">
        ← Back to Songs
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">New Song</h1>
      <p className="mt-1 text-sm text-slate-500">
        Paste the full lyrics below. Leave a blank line between sections — WorshipFlow will
        split them into slides automatically, and detect section names like &quot;Verse
        1&quot;, &quot;Chorus&quot;, or &quot;Bridge&quot; if you&apos;ve typed them in.
        Anything it can&apos;t guess just gets labeled &quot;Other&quot; so you can fix it on
        the next screen. Works the same for any language, including Falam Chin.
      </p>

      <NewSongForm />
    </div>
  );
}
