"use client";

import { useEffect, useMemo, useRef, useState, useCallback, useTransition, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { liveChannelName, autoFitScale, scaleFromPercent, type LivePayload, type LiveSlide } from "@/lib/live-show-types";
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
  // Theme's background photo (Library → Themes), behind the lyric text —
  // separate from imageUrl, which is the whole slide for a "media" item.
  backgroundImageUrl?: string;
  // Where the text sits on screen (Library → Themes → Edit). Defaults to
  // dead-center when absent (media/custom slides don't come from a theme).
  textHAlign?: "left" | "center" | "right";
  textVAlign?: "top" | "middle" | "bottom";
  // Manual text size as a percentage (100 = normal) — set per theme or
  // overridden per individual slide (Library → a song's slides).
  textScale?: number;
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

const JUSTIFY_FOR: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };
const ALIGN_ITEMS_FOR: Record<string, string> = { top: "flex-start", middle: "center", bottom: "flex-end" };

const TYPE_BADGE: Record<string, string> = {
  song: "bg-blue-100 text-blue-700",
  media: "bg-purple-100 text-purple-700",
  custom: "bg-slate-100 text-slate-600",
};

// The Media/Background panel is a second, independent "track" from the
// lyric slide list — same idea as ProPresenter's separate Media layer.
// "theme" is the true default/pass-through: don't touch anything, show
// whatever the song's own theme says (which may itself have a background
// photo, from Library → Themes). "off" explicitly forces no photo at all,
// even if the theme has one. "photo" swaps in a chosen photo. Whichever is
// picked stays applied as the operator clicks through the rest of the song
// until they pick something else.
type MediaOverride = { kind: "theme" } | { kind: "off" } | { kind: "photo"; id: string; url: string; name: string };

function withMediaOverride(slide: Slide, override: MediaOverride): Slide {
  if (override.kind === "photo") {
    return { ...slide, backgroundImageUrl: override.url };
  }
  if (override.kind === "off") {
    return { ...slide, backgroundImageUrl: undefined };
  }
  return slide;
}

function toLiveSlide(slide: Slide): LiveSlide {
  return {
    kind: slide.kind,
    label: slide.label,
    content: slide.content,
    imageUrl: slide.imageUrl,
    backgroundColor: slide.backgroundColor,
    textColor: slide.textColor,
    fontFamily: slide.fontFamily,
    backgroundImageUrl: slide.backgroundImageUrl,
    textHAlign: slide.textHAlign,
    textVAlign: slide.textVAlign,
    textScale: slide.textScale,
  };
}


export function ShowView({
  setList,
  churchName,
  tagline,
  occurrenceId,
  liveToken,
  photoLibrary,
}: {
  setList: SetListItem[];
  churchName: string;
  tagline: string;
  occurrenceId: string;
  liveToken: string;
  photoLibrary: { id: string; name: string; url: string }[];
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
  const [lowerThird, setLowerThird] = useState(false);
  const [stageShowNext, setStageShowNext] = useState(true);
  const [mediaOverride, setMediaOverride] = useState<MediaOverride>({ kind: "theme" });
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
      const current = withMediaOverride(flatSlides[index].slide, mediaOverride);
      const nextRaw = flatSlides[index + 1]?.slide ?? null;
      const next = nextRaw ? withMediaOverride(nextRaw, mediaOverride) : null;
      sendPayload({ type: "slide", slide: current });
      broadcastAndPersist({ type: "slide", current: toLiveSlide(current), next: next ? toLiveSlide(next) : null });
    },
    [flatSlides, sendPayload, broadcastAndPersist, mediaOverride]
  );

  // Swap the background independently of which lyric line is live — e.g.
  // click a photo mid-song and it applies immediately without advancing or
  // rewinding the slide. Re-sends whatever is currently live with the new
  // background; if nothing is live yet, just remembers the choice for the
  // next time the operator goes live.
  const selectMedia = useCallback(
    (override: MediaOverride) => {
      setMediaOverride(override);
      if (liveIndex !== null && !isBlank) {
        const current = withMediaOverride(flatSlides[liveIndex].slide, override);
        const nextRaw = flatSlides[liveIndex + 1]?.slide ?? null;
        const next = nextRaw ? withMediaOverride(nextRaw, override) : null;
        sendPayload({ type: "slide", slide: current });
        broadcastAndPersist({ type: "slide", current: toLiveSlide(current), next: next ? toLiveSlide(next) : null });
      }
    },
    [liveIndex, isBlank, flatSlides, sendPayload, broadcastAndPersist]
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
  // What's actually on screen right now, including any Media/Background
  // override — used for the live preview thumbnail below.
  const previewSlide = liveSlide ? withMediaOverride(liveSlide, mediaOverride) : null;
  // Same manual Text Size × auto-shrink math as the live outputs — the
  // preview box is a fixed size (not full-screen vw), so this scales a
  // rem-based base size instead of the vw-based one used on the real outputs.
  const previewTextScale = previewSlide ? scaleFromPercent(previewSlide.textScale) * autoFitScale(previewSlide.content) : 1;

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

  // Builds a /live/[token]/... URL. Pass extra query params as an object —
  // e.g. { bg: "plain" } for the text-only variant of an output.
  function buildLinkUrl(path: string, params: Record<string, string> = {}): string {
    if (!origin) return "";
    const usp = new URLSearchParams(params);
    const query = usp.toString();
    return `${origin}/live/${liveToken}/${path}${query ? `?${query}` : ""}`;
  }

  const stageUrl = buildLinkUrl("stage", stageShowNext ? {} : { next: "0" });
  const projectorBgUrl = buildLinkUrl("projector");
  const projectorTextUrl = buildLinkUrl("projector", { bg: "plain" });
  const streamLowerThirdUrl = buildLinkUrl("stream", { style: "lowerthird" });
  const streamBgUrl = buildLinkUrl("stream");
  const streamTextUrl = buildLinkUrl("stream", { bg: "plain" });

  function CopyButton({ linkKey, url, children }: { linkKey: string; url: string; children: ReactNode }) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1">
        <span className="text-sm font-medium text-slate-700">{children}</span>
        <button
          type="button"
          onClick={() => url && copyLink(linkKey, url)}
          disabled={!url}
          className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {copiedKey === linkKey ? "Copied!" : "Copy"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      {/* Shareable links — open on any phone or laptop, no login needed.
          Projector and Clean Stream each come as two permanent variants —
          "with background" and "text only" — so you can hand out both at
          once (e.g. the sanctuary screen gets the photo, an OBS overlay
          gets plain text) instead of one link you have to keep re-toggling. */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Links</span>
          <CopyButton linkKey="stage" url={stageUrl}>
            Stage
          </CopyButton>
          <CopyButton linkKey="projector-bg" url={projectorBgUrl}>
            Projector — with background
          </CopyButton>
          <CopyButton linkKey="projector-text" url={projectorTextUrl}>
            Projector — text only
          </CopyButton>
          {lowerThird ? (
            <CopyButton linkKey="stream-lowerthird" url={streamLowerThirdUrl}>
              Clean Stream — lower-third
            </CopyButton>
          ) : (
            <>
              <CopyButton linkKey="stream-bg" url={streamBgUrl}>
                Clean Stream — with background
              </CopyButton>
              <CopyButton linkKey="stream-text" url={streamTextUrl}>
                Clean Stream — text only
              </CopyButton>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <span className="font-medium text-slate-400">Customize:</span>
          <label
            className="flex items-center gap-1.5"
            title="Switches the Clean Stream links from a full screen to just a caption bar near the bottom on a see-through background — for layering lyrics over your camera feed in OBS or similar streaming software."
          >
            <input type="checkbox" checked={lowerThird} onChange={(e) => setLowerThird(e.target.checked)} />
            Stream: lower-third caption instead
          </label>
          <label className="flex items-center gap-1.5" title="Show the upcoming line below the current one on the Stage link, or just the current line by itself, bigger.">
            <input type="checkbox" checked={stageShowNext} onChange={(e) => setStageShowNext(e.target.checked)} />
            Stage: show next line
          </label>
        </div>
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
            className="relative flex aspect-video w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 p-6 text-center"
            style={{
              backgroundColor: isBlank ? "#000000" : previewSlide?.backgroundColor || "#0f172a",
              backgroundImage: !isBlank && previewSlide?.backgroundImageUrl ? `url(${previewSlide.backgroundImageUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              color: previewSlide?.textColor || "#ffffff",
              fontFamily: previewSlide?.fontFamily,
              justifyContent: JUSTIFY_FOR[previewSlide?.textHAlign ?? "center"],
              alignItems: ALIGN_ITEMS_FOR[previewSlide?.textVAlign ?? "middle"],
            }}
          >
            {isBlank ? null : previewSlide?.kind === "image" && previewSlide.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSlide.imageUrl} alt={previewSlide.content} className="max-h-full max-w-full object-contain" />
            ) : previewSlide ? (
              <p
                className="relative whitespace-pre-wrap font-semibold leading-snug"
                style={{
                  fontSize: `${1.5 * previewTextScale}rem`,
                  textShadow: previewSlide.backgroundImageUrl ? "0 2px 10px rgba(0,0,0,0.85)" : undefined,
                  textAlign: previewSlide.textHAlign ?? "center",
                }}
              >
                {previewSlide.content}
              </p>
            ) : (
              <p className="text-sm opacity-60">Nothing live yet</p>
            )}
          </div>
          <p className="-mt-2 text-xs text-slate-400">
            This preview approximates the real screen. Long lyrics shrink automatically to fit — to make a song&rsquo;s text bigger or smaller on
            purpose, set its theme&rsquo;s Text Size in Library → Themes. For the true full-screen look, open the Projector link or Send to Projector.
          </p>

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
                      className={`flex aspect-video flex-col items-center justify-center rounded-lg border-2 bg-cover bg-center p-2 text-center text-xs ${
                        isLive ? "border-red-500" : "border-slate-200 hover:border-slate-400"
                      }`}
                      style={{
                        backgroundColor: slide.backgroundColor,
                        backgroundImage: slide.backgroundImageUrl ? `url(${slide.backgroundImageUrl})` : undefined,
                        color: slide.textColor,
                        textShadow: slide.backgroundImageUrl ? "0 1px 6px rgba(0,0,0,0.85)" : undefined,
                      }}
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

        {/* Media / Background — a second, independent track from the lyric
            slide list. Click a photo (or "None") at any point during a song
            to swap what's behind the words, without changing the line —
            same idea as ProPresenter's separate Media layer. */}
        <div className="flex w-56 shrink-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Media / Background</span>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Click a photo to change the background live, independent of the lyric line.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 p-2">
            <button
              type="button"
              onClick={() => selectMedia({ kind: "theme" })}
              className={`flex aspect-video flex-col items-center justify-center rounded-lg border-2 bg-slate-50 px-1 text-center text-[11px] font-medium text-slate-500 ${
                mediaOverride.kind === "theme" ? "border-red-500" : "border-slate-200 hover:border-slate-400"
              }`}
            >
              Theme
              <span className="text-[10px] font-normal opacity-70">song&rsquo;s own look</span>
            </button>
            <button
              type="button"
              onClick={() => selectMedia({ kind: "off" })}
              className={`flex aspect-video flex-col items-center justify-center rounded-lg border-2 bg-black px-1 text-center text-[11px] font-medium text-white ${
                mediaOverride.kind === "off" ? "border-red-500" : "border-slate-700 hover:border-slate-500"
              }`}
            >
              Off
              <span className="text-[10px] font-normal opacity-70">plain, no photo</span>
            </button>
            {photoLibrary.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => selectMedia({ kind: "photo", id: photo.id, url: photo.url, name: photo.name })}
                title={photo.name}
                className={`aspect-video rounded-lg border-2 bg-cover bg-center ${
                  mediaOverride.kind === "photo" && mediaOverride.id === photo.id ? "border-red-500" : "border-slate-200 hover:border-slate-400"
                }`}
                style={{ backgroundImage: `url(${photo.url})` }}
              />
            ))}
            {photoLibrary.length === 0 && (
              <p className="col-span-2 p-2 text-center text-[11px] text-slate-400">No photos yet — add some in Library → Media.</p>
            )}
          </div>
          <p className="mt-auto border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
            Video files and a live camera feed as a background are coming in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}
