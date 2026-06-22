// ====================================================================
// GET /api/google/image
// Proxyt ein Google-Bild, damit der API-Key serverseitig bleibt.
//   ?type=place&ref=places/.../photos/...   -> Google Place Foto
//   ?type=sv&lat=..&lng=..                   -> Street View Standbild
// Antwort: die Bild-Bytes (mit Cache-Header). 404, wenn nichts da ist.
// ====================================================================

import { googleConfigured, placePhotoMediaUrl, streetViewImageUrl } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!googleConfigured()) return new Response(null, { status: 404 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  let target: string | null = null;
  if (type === "place") {
    const ref = searchParams.get("ref");
    if (ref) target = placePhotoMediaUrl(ref, 640);
  } else if (type === "sv") {
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      target = streetViewImageUrl(lat, lng);
    }
  }
  if (!target) return new Response(null, { status: 400 });

  try {
    const up = await fetch(target, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (!up.ok) return new Response(null, { status: 404 });
    const buf = await up.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": up.headers.get("content-type") ?? "image/jpeg",
        // Standort-Fotos aendern sich kaum -> aggressiv cachen.
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
