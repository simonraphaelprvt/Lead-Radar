// ====================================================================
// Scan-Pipeline v2 (server-seitig)
// --------------------------------------------------------------------
// Datenquelle der Qualifizierung ist jetzt Google Places (Bulk-Qualify):
// pro Branche bis zu 20 Businesses MIT harten Signalen (Rating, Reviews,
// Preislevel, Foto-Anzahl, Typ) in einem Call. Jeder Treffer laeuft durch
// die Reasoning-Engine (lib/reasoning) -> bewerteter Lead.
// Laeuft server-seitig, weil der Google-Key geheim bleiben muss.
// ====================================================================

import { qualifyAreaMulti, placesConfigured } from "./places";
import { qualify, type BusinessSignals, type QualifyOptions } from "./reasoning";
import { getCategory } from "./categories";
import type { Lead, Einstufung } from "./types";

export interface ScanResult {
  leads: Lead[];
  errors: string[];
}

const EINSTUFUNG_RANK: Record<Einstufung, number> = { HOT: 0, WARM: 1, COLD: 2, RAUS: 3 };

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

/** BusinessSignals + Engine-Ergebnis -> Lead (App-Datenstruktur). */
function toLead(s: BusinessSignals, opts?: QualifyOptions): Lead {
  const q = qualify(s, opts);
  const lat = s.lat ?? 0;
  const lng = s.lng ?? 0;
  return {
    id: `g/${slug(s.name)}-${lat.toFixed(4)},${lng.toFixed(4)}`,
    name: s.name,
    address: s.address ?? "",
    lat,
    lng,
    website: s.website ?? undefined,
    phone: s.phone ?? undefined,
    googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${s.name} ${lat},${lng}`,
    )}`,
    imageUrl: undefined,
    photoUrl: undefined,
    instagram: undefined,

    categoryLabel: s.categoryLabel,
    rating: s.rating ?? null,
    reviewCount: s.reviewCount ?? null,
    priceLevel: s.priceLevel ?? null,
    photoCount: s.photoCount ?? null,
    types: s.types,

    einstufung: q.einstufung,
    tier: q.tier,
    tierCOnHold: q.tier_c_on_hold,
    substanzScore: q.substanz_score,
    painMatch: q.pain_match,
    koAusgeschlossen: q.ko_ausgeschlossen,
    koGrund: q.ko_grund,
    empfehlung: q.empfehlung,
    begruendungKurz: q.begruendung_kurz,
    substanz: {
      finanzielle: q.scrapebare_bewertung.finanzielle_substanz,
      visuell: q.scrapebare_bewertung.visuell_darstellbar,
      schmerz: q.scrapebare_bewertung.schmerzpunkt,
    },
    erstkontakt: q.im_erstkontakt_pruefen,
    indeedFlag: false,
  };
}

/** Sortierung: HOT > WARM > COLD > RAUS; Tier-C/on_hold nach hinten; dann Substanz. */
function sortLeads(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const r = EINSTUFUNG_RANK[a.einstufung] - EINSTUFUNG_RANK[b.einstufung];
    if (r !== 0) return r;
    if (a.tierCOnHold !== b.tierCOnHold) return a.tierCOnHold ? 1 : -1;
    return b.substanzScore - a.substanzScore;
  });
}

export async function scanAndQualify(
  origin: { lat: number; lng: number },
  radiusKm: number,
  categoryIds: string[],
  opts?: QualifyOptions,
): Promise<ScanResult> {
  if (!placesConfigured()) {
    return { leads: [], errors: ["GOOGLE_MAPS_API_KEY fehlt - Scan braucht Google Places."] };
  }
  const ids = categoryIds.slice(0, 12);
  const queries = ids.map((id) => {
    const c = getCategory(id);
    return { textQuery: c.label, categoryLabel: c.label };
  });
  if (queries.length === 0) return { leads: [], errors: ["Keine Branche gewaehlt."] };

  try {
    const signals = await qualifyAreaMulti(queries, origin.lat, origin.lng, radiusKm * 1000);
    const leads = sortLeads(signals.map((s) => toLead(s, opts)));
    return { leads, errors: [] };
  } catch (e) {
    return { leads: [], errors: [(e as Error).message] };
  }
}
