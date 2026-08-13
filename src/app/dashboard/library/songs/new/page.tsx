import Link from "next/link";
import { createSong } from "../../actions";

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

      <form action={createSong} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="title" className="text-sm font-medium text-slate-700">
            Song Title
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="e.g. Zangfahnak Hla"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="lyrics" className="text-sm font-medium text-slate-700">
            Lyrics
          </label>
          <textarea
            id="lyrics"
            name="lyrics"
            rows={16}
            placeholder={"Verse 1\nFirst line of the verse...\n\nChorus\nFirst line of the chorus..."}
            className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm leading-relaxed"
          />
        </div>

        <button
          type="submit"
          className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create Song
        </button>
      </form>
    </div>
  );
}
