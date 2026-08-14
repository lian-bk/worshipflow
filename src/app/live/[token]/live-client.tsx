"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { liveChannelName, type LivePayload } from "@/lib/live-show-types";

type Variant = "stage" | "stream" | "projector";

export function LiveClient({
  variant,
  token,
  initialPayload,
  churchName,
}: {
  variant: Variant;
  token: string;
  initialPayload: LivePayload;
  churchName: string;
}) {
  const [payload, setPayload] = useState<LivePayload>(initialPayload);
  const [connected, setConnected] = useState(false);
  const searchParams = useSearchParams();
  // ?style=lowerthird on the Clean Stream link switches from a full-screen
  // slide to a transparent-background caption bar near the bottom — meant
  // for OBS's Browser Source, which renders a page's transparent
  // background as real alpha, so it composites over a camera feed like a
  // TV lower-third instead of covering the whole picture.
  const lowerThird = variant === "stream" && searchParams.get("style") === "lowerthird";
  // ?bg=plain drops each output back to plain black/white text, ignoring
  // the song's own background photo/color — so e.g. the Projector can stay
  // "full look" while the Stream link (or vice versa) shows a simpler,
  // distraction-free version. See the per-output checkboxes on the Show
  // page (show-view.tsx) that set this.
  const plainBg = searchParams.get("bg") === "plain";
  // ?next=0 on the Stage link hides the "coming up" preview, showing only
  // the current line bigger.
  const showNext = searchParams.get("next") !== "0";

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(liveChannelName(token))
      .on("broadcast", { event: "update" }, ({ payload: next }) => {
        setPayload(next as LivePayload);
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token]);

  if (variant === "stage") {
    return <StageOutput payload={payload} churchName={churchName} connected={connected} showNext={showNext} />;
  }
  if (lowerThird) return <LowerThirdOutput payload={payload} />;
  return <FullBleedOutput payload={payload} dimForStream={variant === "stream"} plainBg={plainBg} />;
}

// Bottom-of-screen caption bar for OBS Browser Source — see the ?style
// check above. Only the bar itself has a background; everything else on
// the page stays transparent so the camera feed shows through around it.
function LowerThirdOutput({ payload }: { payload: LivePayload }) {
  const text = payload.type === "slide" ? payload.current.content : payload.type === "logo" ? payload.churchName : "";
  const showBar = (payload.type === "slide" || payload.type === "logo") && !!text;

  return (
    <div style={{ position: "fixed", inset: 0, background: "transparent" }}>
      {showBar && (
        <div
          style={{
            position: "absolute",
            left: "6vw",
            right: "6vw",
            bottom: "7vh",
            padding: "1.4vh 2vw",
            borderRadius: "0.6vw",
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            color: "#ffffff",
            textAlign: "center",
            fontSize: "3vw",
            fontWeight: 600,
            lineHeight: 1.3,
            whiteSpace: "pre-wrap",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

// Shared by the Clean Stream link and the browser-based Projector link —
// same full-screen, no-chrome look as the desktop app's own projector
// window (electron/projector.html), just served as a normal web page so it
// can run on a device that can't install the desktop app.
function FullBleedOutput({ payload, dimForStream, plainBg }: { payload: LivePayload; dimForStream: boolean; plainBg: boolean }) {
  const bg = plainBg ? "#000000" : payload.type === "slide" ? payload.current.backgroundColor : payload.type === "logo" ? "#0f172a" : "#000000";
  const color = plainBg ? "#ffffff" : payload.type === "slide" ? payload.current.textColor : "#ffffff";
  const fontFamily = plainBg ? undefined : payload.type === "slide" ? payload.current.fontFamily : undefined;
  // In plain mode, a photo/image slide falls back to just its text (the
  // image title, since that's all an image slide has) instead of the
  // photo itself — "plain" means text-only on every output, including
  // ones that would otherwise show a background photo.
  const showImage = !plainBg && payload.type === "slide" && payload.current.kind === "image" && payload.current.imageUrl;
  // A theme's background photo (distinct from a "media" item's full-slide
  // image above) — text is drawn over it with a shadow for legibility,
  // same idea as the show-view.tsx preview/slide-grid.
  const backgroundImageUrl = !plainBg && payload.type === "slide" ? payload.current.backgroundImageUrl : undefined;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "6vh 8vw",
        boxSizing: "border-box",
        backgroundColor: bg,
        backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        color,
        fontFamily,
        cursor: dimForStream ? "default" : "none",
      }}
    >
      {payload.type === "slide" && showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={payload.current.imageUrl} alt={payload.current.content} style={{ maxWidth: "92vw", maxHeight: "92vh", objectFit: "contain" }} />
      ) : payload.type === "slide" ? (
        <>
          {payload.current.label && (
            <div
              style={{
                fontSize: "2vw",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                opacity: 0.6,
                marginBottom: "2vh",
                textShadow: backgroundImageUrl ? "0 2px 10px rgba(0,0,0,0.85)" : undefined,
              }}
            >
              {payload.current.label}
            </div>
          )}
          <div
            style={{
              fontSize: "6vw",
              fontWeight: 600,
              lineHeight: 1.3,
              whiteSpace: "pre-wrap",
              maxWidth: "100%",
              textShadow: backgroundImageUrl ? "0 2px 10px rgba(0,0,0,0.85)" : undefined,
            }}
          >
            {payload.current.content}
          </div>
        </>
      ) : payload.type === "logo" ? (
        <>
          <div style={{ fontSize: "6vw", fontWeight: 600 }}>{payload.churchName}</div>
          {payload.tagline && <div style={{ fontSize: "2.2vw", opacity: 0.75, marginTop: "2vh" }}>{payload.tagline}</div>}
        </>
      ) : null}
    </div>
  );
}

// Musicians'/singers' view: current line big, next line clearly labeled
// below so they can prepare — fixed dark/readable theme regardless of the
// song's own on-screen colors, since a stage monitor needs to stay legible
// under stage lighting no matter what theme the audience projector is using.
function StageOutput({
  payload,
  churchName,
  connected,
  showNext,
}: {
  payload: LivePayload;
  churchName: string;
  connected: boolean;
  showNext: boolean;
}) {
  const current = payload.type === "slide" ? payload.current : null;
  const next = payload.type === "slide" ? payload.next : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0b1220",
        color: "#f8fafc",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          fontSize: "0.9rem",
          opacity: 0.6,
        }}
      >
        <span>{churchName} — Stage</span>
        <span style={{ color: connected ? "#4ade80" : "#f87171" }}>{connected ? "● Live" : "○ Connecting…"}</span>
      </div>

      <div
        style={{
          flex: showNext ? "2" : "1",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "4vh 6vw",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "1.4vw", textTransform: "uppercase", letterSpacing: "0.15em", opacity: 0.5, marginBottom: "1.5vh" }}>Now</div>
        {current ? (
          <>
            {current.label && (
              <div style={{ fontSize: "1.6vw", textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.6, marginBottom: "1.5vh" }}>
                {current.label}
              </div>
            )}
            <div style={{ fontSize: showNext ? "4.5vw" : "6vw", fontWeight: 600, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>{current.content}</div>
          </>
        ) : (
          <div style={{ fontSize: "2vw", opacity: 0.4 }}>Nothing live yet</div>
        )}
      </div>

      {showNext && (
        <div
          style={{
            flex: "1",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "3vh 6vw",
            textAlign: "center",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            backgroundColor: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontSize: "1.1vw", textTransform: "uppercase", letterSpacing: "0.15em", opacity: 0.45, marginBottom: "1vh" }}>Next</div>
          {next ? (
            <div style={{ fontSize: "2.2vw", fontWeight: 500, lineHeight: 1.3, whiteSpace: "pre-wrap", opacity: 0.8 }}>
              {next.label ? `${next.label} — ` : ""}
              {next.content}
            </div>
          ) : (
            <div style={{ fontSize: "1.4vw", opacity: 0.35 }}>—</div>
          )}
        </div>
      )}
    </div>
  );
}
