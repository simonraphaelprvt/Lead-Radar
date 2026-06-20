// ====================================================================
// POST /api/places
// Sucht Businesses ueber die OpenStreetMap Overpass API (kostenlos, kein
// Key, kein Billing), bewertet sie und liefert fertige Leads zurueck.
// Eine Union-Abfrage deckt alle gewaehlten Branchen in einem Request ab.
// Caching liegt im Client (localStorage).
// ====================================================================

import { NextResponse } from "next/server";
import {
  overpassQuery,
  osmLatLng,
  osmName,
  osmAddress,
  osmWebsite,
  osmPhone,
  osmHours,
  osmInstagram,
  osmMapsUri,
  type OverpassElement,
} from "@/lib/overpass";
import { getCategory, osmSelectors, categoryForTags } from "@/lib/categories";
import { scoreLead } from "@/lib/scoring";
import { APP_CONFIG } from "@/lib/constants";
import type { Lead, PlacesRequest, PlacesResponse } from "@/lib/types";

export const runtime = "nodejs";

function toLead(el: OverpassElement, categoryId: string): Lead | null {
  const ll = osmLatLng(el);
  if (!ll) return null;
  const tags = el.tags ?? {};
  const cat = getCategory(categoryId);
  const name = osmName(tags);
  const website = osmWebsite(tags);
  const instagram = osmInstagram(tags); // string, falls OSM contact:instagram hat, sonst undefined

  return {
    id: `${el.type}/${el.id}`,
    name,
    address: osmAddress(tags),
    lat: ll.lat,
    lng: ll.lng,
    // OSM liefert keine Sterne, Bewertungsanzahl oder Preisniveau.
    rating: undefined,
    reviewCount: undefined,
    priceLevel: undefined,
    website,
    phone: osmPhone(tags),
    googleMapsUri: osmMapsUri(name, ll.lat, ll.lng),
    primaryType: undefined,
    primaryTypeDisplay: undefined,
    openingHours: osmHours(tags),
    businessStatus: "OPERATIONAL",
    categoryId,
    branchLabel: cat.label,
    instagram,
    indeedFlag: false,
    score: scoreLead({
      categoryId,
      reviewCount: undefined,
      rating: undefined,
      priceLevel: undefined,
      website: website ?? null,
      instagram,
      indeedFlag: false,
    }),
  };
}

export async function POST(req: Request) {
  let body: PlacesRequest;
  try {
    body = (await req.json()) as PlacesRequest;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const { lat, lng, radiusKm, categories } = body;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    typeof radiusKm !== "number" ||
    !Array.isArray(categories) ||
    categories.length === 0
  ) {
    return NextResponse.json(
      { error: "lat, lng, radiusKm und mindestens eine Kategorie sind erforderlich." },
      { status: 400 },
    );
  }

  const radiusKmClamped = Math.min(
    APP_CONFIG.MAX_RADIUS_KM,
    Math.max(APP_CONFIG.MIN_RADIUS_KM, radiusKm),
  );
  const radiusMeters = radiusKmClamped * 1000;
  const center = { lat, lng };
  const cats = categories.slice(0, 12);

  const errors: string[] = [];
  const byId = new Map<string, Lead>();
  let requestCount = 0;

  try {
    requestCount = 1; // eine Union-Abfrage deckt alle Branchen ab
    const elements = await overpassQuery(osmSelectors(cats), center, radiusMeters);
    for (const el of elements) {
      const categoryId = categoryForTags(el.tags ?? {}, cats);
      if (!categoryId) continue;
      const lead = toLead(el, categoryId);
      if (!lead) continue;
      if (!byId.has(lead.id)) byId.set(lead.id, lead);
    }
  } catch (e) {
    errors.push((e as Error).message);
  }

  const leads = Array.from(byId.values()).sort(
    (a, b) => b.score.final - a.score.final,
  );

  const payload: PlacesResponse = { leads, requestCount, errors };
  return NextResponse.json(payload);
}
