// ====================================================================
// POST /api/instagram  (Instagram-Enrichment via Apify, server-only)
// Body: { handles: string[] }  ->  { profiles: Record<handle, IgIntel> }
// Eigene Route (nicht im Scan), damit das Zeitbudget nicht das 60s-Limit
// sprengt. Der Client merged die Profile in die Leads + requalifiziert.
// ====================================================================

import { NextResponse } from "next/server";
import { fetchIgProfiles, apifyConfigured } from "@/lib/instagram";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!apifyConfigured()) {
    return NextResponse.json({ profiles: {}, error: "APIFY_API_TOKEN fehlt." });
  }
  let body: { handles?: unknown };
  try {
    body = (await req.json()) as { handles?: unknown };
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  const handles = Array.isArray(body.handles)
    ? body.handles.filter((h): h is string => typeof h === "string")
    : [];
  if (handles.length === 0) return NextResponse.json({ profiles: {} });

  // Sicherheits-Deckel gegen Ausreisser-Verbrauch (ein Run, ein Scan).
  const profiles = await fetchIgProfiles(handles.slice(0, 40));
  return NextResponse.json({ profiles });
}
