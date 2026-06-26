// ====================================================================
// POST /api/instagram  (Instagram-Enrichment via Apify, server-only)
// Body:
//   { handles: string[] }                    -> { profiles: Record<handle, IgIntel> }
//   { searches: {key,query}[] }              -> { searchResults: Record<key, IgIntel|null> }
// Eigene Route (nicht im Scan), damit das 60s-Limit nicht platzt. Der Client
// merged die Ergebnisse in die Leads + requalifiziert (Engine ist rein).
// ====================================================================

import { NextResponse } from "next/server";
import { fetchIgProfiles, searchIgProfile, apifyConfigured, type IgIntel } from "@/lib/instagram";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  handles?: unknown;
  searches?: unknown;
}

export async function POST(req: Request) {
  if (!apifyConfigured()) {
    return NextResponse.json({ profiles: {}, searchResults: {}, error: "APIFY_API_TOKEN fehlt." });
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
  const searches = Array.isArray(body.searches)
    ? body.searches
        .filter((s): s is { key: string; query: string; name: string } =>
          !!s &&
          typeof (s as { key?: unknown }).key === "string" &&
          typeof (s as { query?: unknown }).query === "string" &&
          typeof (s as { name?: unknown }).name === "string")
        .slice(0, 6) // Deckel: max 6 Suchen pro Call (Zeit/Kosten)
    : [];

  const profiles = handles.length > 0 ? await fetchIgProfiles(handles.slice(0, 40)) : {};

  const searchResults: Record<string, IgIntel | null> = {};
  if (searches.length > 0) {
    const settled = await Promise.allSettled(searches.map((s) => searchIgProfile(s.query, s.name)));
    searches.forEach((s, i) => {
      const r = settled[i];
      searchResults[s.key] = r.status === "fulfilled" ? r.value : null;
    });
  }

  return NextResponse.json({ profiles, searchResults });
}
