import { ImageResponse } from "next/og";

// Renders a church's monthly roster as a single flattened PNG image (via
// Vercel/Next's built-in satori-based ImageResponse — no headless browser,
// no native binary, safe to run in a Vercel serverless function). The PDF
// export (route.ts in the same folder) just wraps this same PNG into a
// one-page PDF, so the two formats always look identical.
//
// Deliberately plain, table-like layout: a colour band at the top, a
// church/team header, one section per service type with a coloured header
// row (service type name + each position's column label), one row per
// date (a separate note row underneath when that date has a note), and an
// optional footer line. Matches how the churches' existing spreadsheets are
// laid out, per the build guide.

export type ExportPosition = { id: string; label: string };
export type ExportRow = {
  dateLabel: string;
  note?: string | null;
  cellsByPosition: Record<string, string | null>; // positionId -> assigned name, or null
};
export type ExportSection = { name: string; rows: ExportRow[] };

export type RosterExportData = {
  churchName: string;
  tagline?: string | null;
  footerText?: string | null;
  teamName: string;
  monthLabel: string;
  statusLabel: string; // "Published" or "Draft"
  accentColor: string; // hex, e.g. "#1d4ed8"
  positions: ExportPosition[];
  sections: ExportSection[];
};

const PAGE_WIDTH = 1700;
const PAD = 48;
const DATE_COL_WIDTH = 210;

function rowHeightFor(row: ExportRow) {
  return row.note ? 70 : 42;
}

export async function renderRosterExportPng(data: RosterExportData): Promise<ArrayBuffer> {
  const positionColWidth = data.positions.length
    ? Math.floor((PAGE_WIDTH - PAD * 2 - DATE_COL_WIDTH) / data.positions.length)
    : 0;

  // Compute total height up front — ImageResponse needs explicit dimensions.
  let height = 150; // header band
  for (const section of data.sections) {
    height += 56; // section header row
    for (const row of section.rows) height += rowHeightFor(row);
    height += 20; // gap after section
  }
  height += data.footerText ? 54 : 12;

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: PAGE_WIDTH,
          height,
          backgroundColor: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Accent bar */}
        <div style={{ display: "flex", width: "100%", height: 10, backgroundColor: data.accentColor }} />

        {/* Header band */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: `28px ${PAD}px 20px ${PAD}px`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#0f172a" }}>
              {data.churchName}
            </div>
            {data.tagline ? (
              <div style={{ display: "flex", fontSize: 18, color: "#64748b", marginTop: 4 }}>{data.tagline}</div>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: data.accentColor }}>
              {data.teamName}
            </div>
            <div style={{ display: "flex", fontSize: 20, color: "#334155", marginTop: 2 }}>{data.monthLabel}</div>
            <div style={{ display: "flex", fontSize: 14, color: "#94a3b8", marginTop: 2 }}>{data.statusLabel}</div>
          </div>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", padding: `0 ${PAD}px` }}>
          {data.sections.map((section, si) => (
            <div key={si} style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
              {/* Section header row */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  backgroundColor: data.accentColor,
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: DATE_COL_WIDTH,
                    padding: "10px 14px",
                    color: "#ffffff",
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  {section.name}
                </div>
                {data.positions.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      width: positionColWidth,
                      padding: "10px 10px",
                      color: "#ffffff",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {p.label}
                  </div>
                ))}
              </div>

              {/* Date rows */}
              {section.rows.map((row, ri) => (
                <div
                  key={ri}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    borderBottom: "1px solid #e2e8f0",
                    backgroundColor: ri % 2 === 0 ? "#ffffff" : "#f8fafc",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "row" }}>
                    <div
                      style={{
                        display: "flex",
                        width: DATE_COL_WIDTH,
                        padding: "10px 14px",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#0f172a",
                      }}
                    >
                      {row.dateLabel}
                    </div>
                    {data.positions.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          width: positionColWidth,
                          padding: "10px 10px",
                          fontSize: 15,
                          color: "#1e293b",
                        }}
                      >
                        {row.cellsByPosition[p.id] || "—"}
                      </div>
                    ))}
                  </div>
                  {row.note ? (
                    <div
                      style={{
                        display: "flex",
                        padding: "0 14px 10px 14px",
                        fontSize: 13,
                        color: data.accentColor,
                        fontStyle: "italic",
                      }}
                    >
                      {row.note}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        {data.footerText ? (
          <div
            style={{
              display: "flex",
              marginTop: "auto",
              padding: `12px ${PAD}px`,
              fontSize: 13,
              color: "#64748b",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            {data.footerText}
          </div>
        ) : null}
      </div>
    ),
    { width: PAGE_WIDTH, height }
  );

  return await image.arrayBuffer();
}
