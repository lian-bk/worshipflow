"use client";

import { useEffect, useState } from "react";
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

  if (variant === "stage") return <StageOutput payload={payload} churchName={churchName} connected={connected} />;
  return <FullBleedOutput payload={payload} dimForStream={variant === "stream"} />;
}

// Shared by the Clean Stream link and the browser-based Projector link —
// same full-screen, no-chrome look as the desktop app's own projector
// window (electron/projector.html), just served as a normal web page so it
// can run on a device that can't install the desktop app.
function FullBleedOutput({ payload, dimForStream }: { payload: LivePayload; dimForStream: boolean }) {
  const bg = payload.type === "slide" ? payload.current.backgroundColor : payload.type === "logo" ? "#0f172a" : "#000000";
  const color = payload.type === "slide" ? payload.current.textColor : "#ffffff";
  const fontFamily = payload.type === "slide" ? payload.current.fontFamily : undefined;

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
        color,
        fontFamily,
        cursor: dimForStream ? "default" : "none",
      }}
    >
      {payload.type === "slide" && payload.current.kind === "image" && payload.current.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={payload.current.imageUrl} alt={payload.current.content} style={{ maxWidth: "92vw", maxHeight: "92vh", objectFit: "contain" }} />
      ) : payload.type === "slide" ? (
        <>
          {payload.current.label && (
            <div style={{ fontSize: "2vw", textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.6, marginBottom: "2vh" }}>
              {payload.current.label}
            </div>
          )}
          <div style={{ fontSize: "6vw", fontWeight: 600, lineHeight: 1.3, whiteSpace: "pre-wrap", maxWidth: "100%" }}>
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
function StageOutput({ payload, churchName, connected }: { payload: LivePayload; churchName: string; connected: boolean }) {
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

      <div style={{ flex: "2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4vh 6vw", textAlign: "center" }}>
        <div style={{ fontSize: "1.4vw", textTransform: "uppercase", letterSpacing: "0.15em", opacity: 0.5, marginBottom: "1.5vh" }}>Now</div>
        {current ? (
          <>
            {current.label && (
              <div style={{ fontSize: "1.6vw", textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.6, marginBottom: "1.5vh" }}>
                {current.label}
              </div>
            )}
            <div style={{ fontSize: "4.5vw", fontWeight: 600, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>{current.content}</div>
          </>
        ) : (
          <div style={{ fontSize: "2vw", opacity: 0.4 }}>Nothing live yet</div>
        )}
      </div>

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
    </div>
  );
}
