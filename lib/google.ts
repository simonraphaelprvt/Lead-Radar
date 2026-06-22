// ====================================================================
// Google Maps Platform - serverseitiger Client (Key NIE im Browser).
// --------------------------------------------------------------------
// Liefert pro Lead: Telefon, Adresse, Oeffnungszeiten (Places API New,
// "searchText") und ein Standort-Foto (Place-Foto bevorzugt, sonst Street
// View Static). Bilder werden ueber /api/google/image proxied, damit der
// Key serverseitig bleibt.
//
// Benoetigt EIN Env: GOOGLE_MAPS_API_KEY  (Billing am Projekt aktiv, APIs
// aktiviert: "Places API (New)" + "Street View Static API").
// Ohne Key liefert alles leer/false -> die App faellt sauber auf Website-
// Bild bzw. Satellit + Ein-Klick-Links zurueck.
// ====================================================================

const KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const PLACES_BASE = "https://places.googleapis.com/v1";
const SV_BASE = "https://maps.googleapis.com/maps/api/streetview";

export function googleConfigured(): boolean {
  return KEY.length > 0;
}

export interface GooglePlace {
  phone: string | null;
  address: string | null;
  openingHours: string[] | null;
  website: string | null;
  googleMapsUri: string | null;
  /** "places/XXX/photos/YYY" - Eingabe fuer placePhotoMediaUrl. */
  photoName: string | null;
}

/** Grobe Distanz in Metern (Haversine) zum besten Treffer-Ranking. */
function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Sucht das Business per Name + Standort und liefert die Kontaktdaten des
 * raeumlich naechsten Treffers. Null, wenn nichts gefunden / kein Key.
 */
export async function findPlace(
  name: string,
  lat: number,
  lng: number,
  address?: string,
): Promise<GooglePlace | null> {
  if (!KEY) return null;
  const textQuery = [name, address].filter(Boolean).join(", ").trim() || name;
  try {
    const res = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask": [
          "places.displayName",
          "places.nationalPhoneNumber",
          "places.internationalPhoneNumber",
          "places.formattedAddress",
          "places.regularOpeningHours.weekdayDescriptions",
          "places.photos",
          "places.location",
          "places.websiteUri",
          "places.googleMapsUri",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery,
        locationBias: {
          circle: { center: { latitude: lat, longitude: lng }, radius: 600 },
        },
        maxResultCount: 5,
        languageCode: "de",
      }),
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { places?: GooglePlaceRaw[] };
    const places = data.places ?? [];
    if (places.length === 0) return null;

    // Googles ERSTER Treffer ist der nach Name/Relevanz beste (die textQuery
    // enthielt Name + Adresse). NICHT nach Distanz umsortieren - sonst gewinnt
    // bei dicht beieinander liegenden Betrieben der falsche, naehere Laden.
    // Nur als Plausi-Bremse: liegt der Treffer absurd weit vom OSM-Punkt
    // (>2 km), ist es vermutlich der falsche -> lieber nichts liefern.
    const best = places[0];
    if (
      best.location &&
      distanceMeters(lat, lng, best.location.latitude, best.location.longitude) > 2000
    ) {
      return null;
    }

    return {
      phone: best.nationalPhoneNumber ?? best.internationalPhoneNumber ?? null,
      address: best.formattedAddress ?? null,
      openingHours: best.regularOpeningHours?.weekdayDescriptions ?? null,
      website: best.websiteUri ?? null,
      googleMapsUri: best.googleMapsUri ?? null,
      photoName: best.photos?.[0]?.name ?? null,
    };
  } catch {
    return null;
  }
}

interface GooglePlaceRaw {
  displayName?: { text?: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  formattedAddress?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: { name?: string }[];
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
  googleMapsUri?: string;
}

/** Pruefer (kostenlose Metadaten): gibt es Street-View-Bilder am Punkt? */
export async function hasStreetView(lat: number, lng: number): Promise<boolean> {
  if (!KEY) return false;
  try {
    const res = await fetch(
      `${SV_BASE}/metadata?location=${lat},${lng}&source=outdoor&key=${KEY}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return false;
    const d = (await res.json()) as { status?: string };
    return d.status === "OK";
  } catch {
    return false;
  }
}

/** Upstream-URL eines Place-Fotos (nur serverseitig nutzen, enthaelt Key). */
export function placePhotoMediaUrl(photoName: string, maxWidthPx = 640): string {
  return `${PLACES_BASE}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${KEY}`;
}

/** Upstream-URL eines Street-View-Standbilds (nur serverseitig, enthaelt Key). */
export function streetViewImageUrl(lat: number, lng: number, w = 640, h = 360): string {
  return `${SV_BASE}?size=${w}x${h}&location=${lat},${lng}&fov=80&return_error_code=true&key=${KEY}`;
}
