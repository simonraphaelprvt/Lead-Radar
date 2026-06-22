// ====================================================================
// POST /api/google
// Liefert pro Lead Google-Daten: Telefon, Adresse, Oeffnungszeiten und eine
// SAME-ORIGIN Foto-URL (Place-Foto bevorzugt, sonst Street View). Der Key
// bleibt serverseitig. Ohne Key -> { configured: false }.
//
// Body: { name, lat, lng, address? }
// ====================================================================

import { NextResponse } from "next/server";
import { googleConfigured, findPlace, hasStreetView } from "@/lib/google";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!googleConfigured()) {
    return NextResponse.json({ configured: false });
  }

  let body: { name?: string; lat?: number; lng?: number; address?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const { name, lat, lng, address } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat und lng erforderlich." }, { status: 400 });
  }

  const place = await findPlace(name ?? "", lat, lng, address);

  // Foto-Quelle bestimmen: echtes Place-Foto bevorzugt, sonst Street View.
  let photoUrl: string | null = null;
  if (place?.photoName) {
    photoUrl = `/api/google/image?type=place&ref=${encodeURIComponent(place.photoName)}`;
  } else if (await hasStreetView(lat, lng)) {
    photoUrl = `/api/google/image?type=sv&lat=${lat}&lng=${lng}`;
  }

  return NextResponse.json({
    configured: true,
    phone: place?.phone ?? null,
    address: place?.address ?? null,
    openingHours: place?.openingHours ?? null,
    website: place?.website ?? null,
    googleMapsUri: place?.googleMapsUri ?? null,
    photoUrl,
  });
}
