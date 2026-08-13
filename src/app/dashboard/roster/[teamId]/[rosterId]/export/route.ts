import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { renderRosterExportPng, type ExportRow, type ExportSection } from "@/lib/roster-export";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DEFAULT_COLOR = "#1d4ed8";
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function formatDateLabel(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// GET /dashboard/roster/[teamId]/[rosterId]/export?format=png|pdf&color=%23RRGGBB
// Read-only — same "everyone in the church can see rosters" access as the
// roster pages themselves (enforced by RLS on every query below), so no
// separate admin/leader check is needed here.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; rosterId: string }> }
) {
  const { teamId, rosterId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") === "pdf" ? "pdf" : "png";
  const colorParam = searchParams.get("color");
  const accentColor = colorParam && HEX_COLOR_RE.test(colorParam) ? colorParam : DEFAULT_COLOR;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("church_id")
    .eq("id", user.id)
    .single();
  if (!profile?.church_id) return NextResponse.json({ error: "No church on this account." }, { status: 403 });

  const { data: roster } = await supabase
    .from("rosters")
    .select("id, team_id, month, year, status")
    .eq("id", rosterId)
    .single();
  if (!roster || roster.team_id !== teamId) return NextResponse.json({ error: "Roster not found." }, { status: 404 });

  const [{ data: team }, { data: church }] = await Promise.all([
    supabase.from("teams").select("id, name").eq("id", teamId).single(),
    supabase.from("churches").select("name, tagline, roster_footer_text").eq("id", profile.church_id).single(),
  ]);
  if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  const daysInMonth = new Date(roster.year, roster.month, 0).getDate();
  const monthStart = `${roster.year}-${String(roster.month).padStart(2, "0")}-01`;
  const monthEnd = `${roster.year}-${String(roster.month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const [{ data: positions }, { data: memberRows }, { data: serviceTypes }] = await Promise.all([
    supabase.from("team_positions").select("id, label, display_order").eq("team_id", teamId).order("display_order"),
    supabase.from("team_members").select("user_id").eq("team_id", teamId),
    supabase
      .from("service_types")
      .select("id, name")
      .eq("church_id", profile.church_id)
      .order("name"),
  ]);

  const memberUserIds = (memberRows ?? []).map((m) => m.user_id);
  const { data: memberPeople } = memberUserIds.length
    ? await supabase.from("users").select("id, full_name, email").in("id", memberUserIds)
    : { data: [] };
  const nameByUserId = new Map((memberPeople ?? []).map((p) => [p.id, p.full_name || p.email || "Unnamed"]));

  const serviceTypeIds = (serviceTypes ?? []).map((st) => st.id);

  const [{ data: sharedOccurrences }, { data: extraOccurrences }, { data: rosterNotes }, { data: assignments }] =
    await Promise.all([
      serviceTypeIds.length
        ? supabase
            .from("service_occurrences")
            .select("id, service_type_id, date, note")
            .in("service_type_id", serviceTypeIds)
            .gte("date", monthStart)
            .lte("date", monthEnd)
            .order("date")
        : Promise.resolve({ data: [] as { id: string; service_type_id: string | null; date: string; note: string | null }[] }),
      supabase.from("service_occurrences").select("id, date, note").eq("roster_id", rosterId).order("date"),
      supabase.from("roster_notes").select("service_occurrence_id, note").eq("roster_id", rosterId),
      supabase.from("roster_assignments").select("service_occurrence_id, team_position_id, user_id").eq("roster_id", rosterId),
    ]);

  const notesByOccurrence = new Map((rosterNotes ?? []).map((n) => [n.service_occurrence_id, n.note]));
  const cellsByOccurrence = new Map<string, Record<string, string | null>>();
  for (const a of assignments ?? []) {
    if (!a.user_id) continue;
    if (!cellsByOccurrence.has(a.service_occurrence_id)) cellsByOccurrence.set(a.service_occurrence_id, {});
    cellsByOccurrence.get(a.service_occurrence_id)![a.team_position_id] = nameByUserId.get(a.user_id) || "Unnamed";
  }

  function buildRow(occ: { id: string; date: string; note?: string | null }, teamNote?: string): ExportRow {
    const combinedNote = [occ.note, teamNote].filter(Boolean).join(" — ") || undefined;
    return {
      dateLabel: formatDateLabel(occ.date),
      note: combinedNote,
      cellsByPosition: cellsByOccurrence.get(occ.id) || {},
    };
  }

  const serviceTypeById = new Map((serviceTypes ?? []).map((st) => [st.id, st]));
  const sectionsMap = new Map<string, ExportSection>();
  for (const occ of sharedOccurrences ?? []) {
    if (!occ.service_type_id) continue;
    const st = serviceTypeById.get(occ.service_type_id);
    if (!st) continue;
    if (!sectionsMap.has(st.id)) sectionsMap.set(st.id, { name: st.name.toUpperCase(), rows: [] });
    sectionsMap.get(st.id)!.rows.push(buildRow(occ, notesByOccurrence.get(occ.id) || undefined));
  }
  const sections = [...sectionsMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  if ((extraOccurrences ?? []).length > 0) {
    sections.push({
      name: "EXTRA DATES",
      rows: (extraOccurrences ?? []).map((occ) => buildRow(occ, notesByOccurrence.get(occ.id) || undefined)),
    });
  }

  const pngBuffer = await renderRosterExportPng({
    churchName: church?.name || "Church",
    tagline: church?.tagline || null,
    footerText: church?.roster_footer_text || null,
    teamName: team.name,
    monthLabel: `${MONTH_NAMES[roster.month - 1]} ${roster.year}`,
    statusLabel: roster.status === "published" ? "Published" : "Draft",
    accentColor,
    positions: (positions ?? []).map((p) => ({ id: p.id, label: p.label })),
    sections,
  });

  const fileBase = `${team.name.replace(/[^a-z0-9]+/gi, "-")}-${MONTH_NAMES[roster.month - 1]}-${roster.year}`;

  if (format === "png") {
    return new NextResponse(Buffer.from(pngBuffer), {
      headers: {
        "content-type": "image/png",
        "content-disposition": `inline; filename="${fileBase}.png"`,
      },
    });
  }

  // PDF: wrap the exact same PNG into a one-page, landscape-Letter-scaled PDF.
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  const pageWidthPt = 792; // US Letter landscape width, in points
  const scale = pageWidthPt / pngImage.width;
  const pageHeightPt = pngImage.height * scale;
  const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
  page.drawImage(pngImage, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt });
  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileBase}.pdf"`,
    },
  });
}
