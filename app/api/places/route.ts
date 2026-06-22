// ====================================================================
// POST /api/places  (Scan)
// Server-seitiger Scan: Google Bulk-Qualify + Reasoning-Engine (lib/scan).
// Body: { lat, lng, radiusKm, categories[] }  ->  { leads, count, errors }
// ====================================================================

import { NextResponse } from "next/server";
import { scanAndQualify } from "@/lib/scan";
import type { ScanRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: ScanRequest;
  try {
    body = (await req.json()) as ScanRequest;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const { lat, lng, radiusKm, categories, filterChains } = body;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    typeof radiusKm !== "number" ||
    !Array.isArray(categories) ||
    categories.length === 0
  ) {
    return NextResponse.json(
      { error: "lat, lng, radiusKm und mindestens eine Branche sind erforderlich." },
      { status: 400 },
    );
  }

  const { leads, errors } = await scanAndQualify({ lat, lng }, radiusKm, categories, {
    filterChains: filterChains !== false,
  });
  return NextResponse.json({ leads, count: leads.length, errors });
}
