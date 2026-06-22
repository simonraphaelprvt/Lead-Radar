// ====================================================================
// Google Places - Bulk-Qualify (Signal-Versorgung fuer die Reasoning-Engine)
// --------------------------------------------------------------------
// Holt pro Branche/Gebiet bis zu 20 Businesses MIT den harten Signalen
// (Rating, Review-Anzahl, Preislevel, Foto-Anzahl, Typ) in EINEM Call.
// Text Search (New). Server-only (Key bleibt geheim).
// ====================================================================

import type { BusinessSignals } from "./reasoning";

const KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

export function placesConfigured(): boolean {
  return KEY.length > 0;
}

// Google PRICE_LEVEL_* (New) -> 0..4 (oder null = unbekannt)
const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

interface PlaceRaw {
  displayName?: { text?: string };
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  photos?: { name?: string }[];
  websiteUri?: string;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  location?: { latitude: number; longitude: number };
  businessStatus?: string;
}

const FIELD_MASK = [
  "places.displayName",
  "places.types",
  "places.primaryType",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.photos",
  "places.websiteUri",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.location",
  "places.businessStatus",
].join(",");

/** Wandelt ein Google-Place in normalisierte Signale (nur reale Werte). */
function toSignals(p: PlaceRaw, categoryLabel: string): BusinessSignals {
  return {
    name: p.displayName?.text ?? "(ohne Namen)",
    categoryLabel,
    types: [p.primaryType, ...(p.types ?? [])].filter(Boolean) as string[],
    rating: typeof p.rating === "number" ? p.rating : null,
    reviewCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    priceLevel: p.priceLevel != null ? (PRICE_MAP[p.priceLevel] ?? null) : null,
    photoCount: Array.isArray(p.photos) ? p.photos.length : null,
    website: p.websiteUri ?? null,
    hasSocial: null, // aus Places nicht ableitbar -> unbekannt
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    address: p.formattedAddress ?? null,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
  };
}

/**
 * Eine Branche/Gebiet abfragen. textQuery z.B. "Hotel", "Autohaus".
 * locationBias als Kreis um (lat,lng). Liefert bis zu maxResults Signale.
 */
export async function qualifyArea(
  textQuery: string,
  categoryLabel: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  maxResults = 20,
): Promise<BusinessSignals[]> {
  if (!KEY) return [];
  try {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        locationBias: {
          circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radiusMeters, 50000) },
        },
        maxResultCount: Math.min(maxResults, 20),
        languageCode: "de",
        regionCode: "DE",
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { places?: PlaceRaw[] };
    return (data.places ?? []).map((p) => toSignals(p, categoryLabel));
  } catch {
    return [];
  }
}

/** Mehrere Branchen in einem Gebiet, dedupliziert nach Name+Adresse. */
export async function qualifyAreaMulti(
  queries: { textQuery: string; categoryLabel: string }[],
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<BusinessSignals[]> {
  const results = await Promise.all(
    queries.map((q) => qualifyArea(q.textQuery, q.categoryLabel, lat, lng, radiusMeters)),
  );
  const seen = new Set<string>();
  const out: BusinessSignals[] = [];
  for (const list of results) {
    for (const s of list) {
      const key = `${s.name}|${s.address ?? ""}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}
