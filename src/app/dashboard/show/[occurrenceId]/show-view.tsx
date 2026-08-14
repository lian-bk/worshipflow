"use client";

import { useEffect, useMemo, useRef, useState, useCallback, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { liveChannelName, type LivePayload, type LiveSlide } from "@/lib/live-show-types";
import { publishLiveState } from "./actions";

export type Slide = {
  id: string;
  kind: "lyric" | "title" | "image";
  label?: string;
  content: string;
  imageUrl?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily?: string;
};
export type SetListItem = {
  id: string;
  title: string;
  itemType: "song" | "media" | "custom";
  slides: Slide[];
};

type ProjectorPayload =
  | { type: "slide"; slide: Slide }
  | { type: "blank" }
  | { type: "logo"; churchName: string; tagline: string };

type ElectronDisplay = { id: number; label: string; isPrimary: boolean; width: number; height: number };

// Only present when this page is running inside the WorshipFlow desktop
// app (electron/preload.js) — a plain browser tab (or the deployed website
// viewed in Chrome) simply won't have this, and the UI below adapts by
// hiding the projector controls and explaining why.
declare global {
  interface Window {
    electronAPI?: {
      isElectron: true;
      platform: string;
      listDisplays: () => Promise<ElectronDisplay[]>;
      openProjector: (displayId: number) => Promise<void>;
      closeProjector: () => Promise<void>;
      sendToProjector: (payload: ProjectorPayload) => void;
    };
  }
}

const TYPE_BADGE: Record<string, string> = {
  song: "bg-blue-100 text-blue-700",
  media: "bg-purple-100 text-purple-700",
  custom: "bg-slate-100 text-slate-600",
};

function toLiveSlide(slide: Slide): LiveSlide {
  return {
    kind: slide.kind,
    label: slide.label,
    content: slide.content,
    imageUrl: slide.imageUrl,
    backgroundColor: slide.backgroundColor,
    textColor: slide.textColor,
    fontFamily: slide.fontFamily,
  };
}

const LINK_TYPES: { key: string; label: string; path: string; hint: string }[] = [
  { key: "stage", label: "Stage", path: "stage", hint: "For musicians/singers — shows the current line plus what's next." },
  { key: "stream", label: "Clean Stream", path: "stream", hint: "For OBS/live streaming — just the slide, no menus." },
  { key: "projector", label: "Projector", path: "projector", hint: "Same output as the desktop app's projector window, as a web link." },
];

export function ShowView({
  setList,
  churchName,
  tagline,
  occurrenceId,
  liveToken,
}: {
  setList: SetListItem[];
  churchName: string;
  tagline: string;
  occurrenceId: string;
  liveToken: string;
}) {
  const flatSlides = useMemo(() => {
    const out: { itemId: string; slide: Slide }[] = [];
    for (const item of setList) for (const slide of item.slides) out.push({ itemId: item.id, slide });
    return out;
  }, [setList]);

  const [liveIndex, setLiveIndex] = useState<number | null>(null);
  const [isBlank, setIsBlank] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [displays, setDisplays] = useState<ElectronDisplay[]>([]);
  const [projectorOpen, setProjectorOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI) {
      setIsElectron(true);
      window.electronAPI.listDisplays().then(setDisplays);
    }
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // One Realtime broadcast channel for this occurrence's live-show links.
  // Anyone with a /live/[token]/... link (no login needed) subscribes to
  // this same channel name and gets pushed every update instantly — see
  // src/app/live/[token]/live-client.tsx.
  const [supabase] = useState(() => createClient());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase.channel(liveChannelName(liveToken));
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [liveToken, supabase]);

  const broadcastAndPersist = useCallback(
    (payload: LivePayload) => {
      channelRef.current?.send({ type: "broadcast", event: "update", payload });
      startTransition(() => {
        publishLiveState(occurrenceId, payload).catch(() => {
          // Best-effort — the Realtime broadcast above already reached anyone
          // currently watching a link; this just keeps late joiners in sync.
        });
      });
    },
    [occurrenceId]
  );

  const sendPayload = useCallback((payload: ProjectorPayload) => {
    window.electronAPI?.sendToProjector(payload);
  }, []);

  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= flatSlides.length) return;
      setLiveIndex(index);
      setIsBlank(false);
      const current = flatSlides[index].slide;
      const next = flatSlides[index + 1]?.slide ?? null;
      sendPayload({ type: "slide", slide: current });
      broadcastAndPersist({ type: "slide", current: toLiveSlide(current), next: next ? toLiveSlide(next) : null });
    },
    [flatSlides, sendPayload, broadcastAndPersist]
  );

  const goNext = useCallback(() => {
    if (liveIndex === null) {
      if (flatSlides.length > 0) goToSlide(0);
      return;
    }
    goToSlide(liveIndex + 1);
  }, [liveIndex, flatSlides.length, goToSlide]);

  const goPrev = useCallback(() => {
    if (liveIndex === null) return;
    goToSlide(liveIndex - 1);
  }, [liveIndex, goToSlide]);

  const clearProjector = useCallback(() => {
    setIsBlank(true);
    sendPayload({ type: "blank" });
    broadcastAndPersist({ type: "blank" });
  }, [sendPayload, broadcastAndPersist]);

  const showLogo = useCallback(() => {
    setIsBlank(false);
    setLiveIndex(null);
    sendPayload({ type: "logo", churchName, tagline });
    broadcastAndPersist({ type: "logo", churchName, tagline });
  }, [sendPayload, broadcastAndPersist, churchName, tagline]);

  // Keyboard shortcuts: Right/Down/Enter/Space = next, Left/Up = previous,
  // Escape = Clear/Black. Ignored while typing in a form field.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (["ArrowRight", "ArrowDown", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        goNext();
      } else if (["ArrowLeft", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearProjector();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, clearProjector]);

  const liveSlide = liveIndex !== null ? flatSlides[liveIndex]?.slide : null;
  const activeItemId = liveSlide ? flatSlides[liveIndex!]?.itemId : null;

  async function handleOpenProjector(displayId: number) {
    await window.electronAPI?.openProjector(displayId);
    setProjectorOpen(true);
  }

  async function handleCloseProjector() {
    await window.electronAPI?.closeProjector();
    setProjectorOpen(false);
  }

  async function copyLink(key: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. plain http:// on a LAN IP) —
      // the full link text is still shown and can be selected by hand.
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      {/* Shareable links — open on any phone or laptop, no login needed. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Links</span>
        {LINK_TYPES.map((lt) => {
          const url = origin ? `${origin}/live/${liveToken}/${lt.path}` : "";
          return (
            <div key={lt.key} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1" title={lt.hint}>
              <span className="text-sm font-medium text-slate-700">{lt.label}</span>
              <button
                type="button"
                onClick={() => url && copyLink(lt.key, url)}
                disabled={!url}
                className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {copiedKey === lt.key ? "Copied!" : "Copy"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Set list */}
        <div className="flex w-64 shrink-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {setList.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-400">Nothing planned for this service yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {setList.map((item) => {
                const firstSlideIndex = flatSlides.findIndex((f) => f.itemId === item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => firstSlideIndex >= 0 && goToSlide(firstSlideIndex)}
                      className={`flex w-full flex-col gap-1 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                        activeItemId === item.id ? "bg-slate-100" : ""
                      }`}
                    >
                      <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${TYPE_BADGE[item.itemType]}`}>
                        {item.itemType}
                      </span>
                      <span className="font-medium text-slate-900">{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Slide grid for the active item */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <button
              type="button"
              onClick={goPrev}
              disabled={liveIndex === null || liveIndex === 0}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={flatSlides.length === 0 || liveIndex === flatSlides.length - 1}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30"
            >
              Next →
            </button>
            <button
              type="button"
              onClick={clearProjector}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Clear / Black
            </button>
            <button
              type="button"
              onClick={showLogo}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Logo
            </button>

            <div className="ml-auto flex items-center gap-2">
              {!isElectron ? (
                <span className="text-xs text-slate-400">
                  The desktop app&rsquo;s own projector window needs WorshipFlow desktop — but the Links above work in any browser.
                </span>
              ) : !projectorOpen ? (
                <>
                  <select
                    id="display-picker"
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose a screen…
                    </option>
                    {displays.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label} {d.isPrimary ? "(this laptop)" : ""} — {d.width}×{d.height}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const select = document.getElementById("display-picker") as HTMLSelectElement;
                      if (select.value) handleOpenProjector(Number(select.value));
                    }}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Send to Projector
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleCloseProjector}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close Projector Window
                </button>
              )}
            </div>
          </div>

          {/* Live preview thumbnail */}
          <div
            className="flex aspect-video w-full max-w-2xl items-center justify-center rounded-xl border border-slate-200 p-6 text-center"
            style={{
              backgroundColor: isBlank ? "#000000" : liveSlide?.backgroundColor || "#0f172a",
              color: liveSlide?.textColor || "#ffffff",
              fontFamily: liveSlide?.fontFamily,
            }}
          >
            {isBlank ? null : liveSlide?.kind === "image" && liveSlide.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={liveSlide.imageUrl} alt={liveSlide.content} className="max-h-full max-w-full object-contain" />
            ) : liveSlide ? (
              <p className="whitespace-pre-wrap text-2xl font-semibold leading-snug">{liveSlide.content}</p>
            ) : (
              <p className="text-sm opacity-60">Nothing live yet</p>
            )}
          </div>

          {/* Slide grid for the currently selected item */}
          <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
            {activeItemId ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {(setList.find((i) => i.id === activeItemId)?.slides ?? []).map((slide) => {
                  const idx = flatSlides.findIndex((f) => f.slide.id === slide.id);
                  const isLive = idx === liveIndex && !isBlank;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => goToSlide(idx)}
                      className={`flex aspect-video flex-col items-center justify-center rounded-lg border-2 p-2 text-center text-xs ${
                        isLive ? "border-red-500" : "border-slate-200 hover:border-slate-400"
                      }`}
                      style={{ backgroundColor: slide.backgroundColor, color: slide.textColor }}
                    >
                      {slide.label && <span className="mb-1 text-[10px] font-semibold uppercase opacity-70">{slide.label}</span>}
                      <span className="line-clamp-4 whitespace-pre-wrap">{slide.content}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="p-6 text-center text-sm text-slate-400">Pick something from the set list on the left.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
