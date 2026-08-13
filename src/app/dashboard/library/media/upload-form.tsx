"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createMediaRecord } from "./actions";

// Uploads happen directly from the browser to Supabase Storage (bypassing the
// Server Action payload limit), then a Server Action records the metadata row
// once the file has fully landed. RLS on storage.objects (see
// 0005_phase3_library.sql) makes sure this church can only ever write inside
// its own "<church_id>/…" folder.
export function UploadForm({ churchId }: { churchId: string }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickKind(f: File): "image" | "pptx" | null {
    if (f.type.startsWith("image/")) return "image";
    if (f.name.toLowerCase().endsWith(".pptx")) return "pptx";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    const kind = pickKind(file);
    if (!kind) {
      setError("Only images (jpg, png, gif, webp) and PowerPoint (.pptx) files are supported here.");
      return;
    }
    setStatus("uploading");
    setError(null);
    setWarning(null);
    try {
      const supabase = createClient();
      const extension = file.name.includes(".") ? file.name.split(".").pop() : "";
      const path = `${churchId}/media/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;

      const { error: uploadError } = await supabase.storage.from("media").upload(path, file, {
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);

      const result = await createMediaRecord({
        name: name.trim() || file.name,
        storagePath: path,
        kind,
      });
      if (result.warning) setWarning(result.warning);

      setName("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStatus("error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-slate-900">Upload image or PowerPoint</h2>
      <p className="text-xs text-slate-500">
        PowerPoint files are automatically converted into slide images once uploaded.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pptx"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
        }}
        className="text-sm"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (optional — defaults to file name)"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {warning && <p className="text-xs text-amber-600">{warning}</p>}
      <button
        type="submit"
        disabled={status === "uploading" || !file}
        className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {status === "uploading" ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
