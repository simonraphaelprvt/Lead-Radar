// ====================================================================
// POST /api/instagram  (Instagram-Enrichment via Apify, server-only)
// Body:
//   { handles: string[] }                      -> { profiles: Record<handle, IgIntel> }
//   { resolves: {key,name,suffixes}[] }        -> { resolveResults: Record<key, IgIntel|null> }
// Eigene Route (nicht im Scan). Der Client merged + requalifiziert (Engine rein).
// ====================================================================

import { NextResponse } from "next/server";
import { fetchIgProfiles, resolveByGuesses, apifyConfigured, type IgIntel } from "@/lib/instagram";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  handles?: unknown;
  resolves?: unknown;
}

export async function POST(req: Request) {
  if (!apifyConfigured()) {
    return NextResponse.json({ profiles: {}, resolveResults: {}, error: "APIFY_API_TOKEN fehlt." });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const handles = Array.isArray(body.handles)
    ? body.handles.filter((h): h is string => typeof h === "string")
    : [];
  const resolves = Array.isArray(body.resolves)
    ? body.resolves
        .filter((r): r is { key: string; name: string; suffixes: string[] } =>
          !!r &&
          typeof (r as { key?: unknown }).key === "string" &&
          typeof (r as { name?: unknown }).name === "string" &&
          Array.isArray((r as { suffixes?: unknown }).suffixes))
        .slice(0, 25)
    : [];

  const profiles = handles.length > 0 ? await fetchIgProfiles(handles.slice(0, 40)) : {};
  const resolveResults: Record<string, IgIntel | null> =
    resolves.length > 0 ? await resolveByGuesses(resolves) : {};

  return NextResponse.json({ profiles, resolveResults });
}
