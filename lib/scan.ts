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
import { qualify, runKO, type BusinessSignals, type QualifyOptions } from "./reasoning";
import { enrichSite } from "./enrich";
import { getCategory } from "./categories";
import type { Lead, Einstufung } from "./types";

export interface ScanResult {
  leads: Lead[];
  errors: string[];
}

const EINSTUFUNG_RANK: Record<Einstufung, number> = { IN_NEED: 0, INTERESTED: 1, COMMON: 2, RAUS: 3 };

// Enrichment: nur Nicht-KO-Leads mit Website, Concurrency-Pool + hartes
// Zeitbudget. Was nicht rechtzeitig faellt, bleibt un-angereichert (-> Pain-
// Signale "nicht pruefbar" -> Erstkontakt). Haengt den Scan nie auf.
const ENRICH_CONCURRENCY = 10;
const ENRICH_BUDGET_MS = 28_000;

async function enrichSignals(signals: BusinessSignals[], opts?: QualifyOptions): Promise<void> {
  const targets = signals.filter((s) => !!s.website && !runKO(s, opts));
  if (targets.length === 0) return;
  const deadline = Date.now() + ENRICH_BUDGET_MS;
  let next = 0;
  async function worker() {
    while (next < targets.length && Date.now() < deadline) {
      const s = targets[next++];
      const intel = await enrichSite(s.website, { igProbe: true });
      Object.assign(s, intel);
    }
  }
  const workers = Array.from({ length: Math.min(ENRICH_CONCURRENCY, targets.length) }, worker);
  await Promise.all(workers);
}

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
    instagram: s.instagramHandle ? `https://instagram.com/${s.instagramHandle}` : undefined,

    categoryLabel: s.categoryLabel,
    rating: s.rating ?? null,
    reviewCount: s.reviewCount ?? null,
    priceLevel: s.priceLevel ?? null,
    photoCount: s.photoCount ?? null,
    types: s.types,

    // Enrichment-Signale auf dem Lead sichern (fuer Cache + reines Requalify).
    siteReachable: s.siteReachable ?? null,
    siteHttps: s.siteHttps ?? null,
    siteResponsive: s.siteResponsive ?? null,
    siteBuilder: s.siteBuilder ?? null,
    instagramHandle: s.instagramHandle ?? null,
    igChecked: s.igChecked ?? false,
    igLastPostDaysAgo: s.igLastPostDaysAgo ?? null,

    einstufung: q.einstufung,
    tier: q.tier,
    tierCOnHold: q.tier_c_on_hold,
    payScore: q.pay_score,
    needScore: q.need_score,
    fitScore: q.fit_score,
    painMatchScore: q.pain_match_score,
    finalScore: q.final_score,
    painSignals: q.pain_signals,
    koAusgeschlossen: q.ko_ausgeschlossen,
    koGrund: q.ko_grund,
    empfehlung: q.empfehlung,
    begruendungKurz: q.begruendung_kurz,
    achsen: { pay: q.pay, need: q.need, fit: q.fit },
    erstkontakt: q.im_erstkontakt_pruefen,
    indeedFlag: false,
  };
}

/** Sortierung: IN_NEED > INTERESTED > COMMON > RAUS; off-profile nach hinten; dann final_score. */
function sortLeads(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const r = EINSTUFUNG_RANK[a.einstufung] - EINSTUFUNG_RANK[b.einstufung];
    if (r !== 0) return r;
    if (a.tierCOnHold !== b.tierCOnHold) return a.tierCOnHold ? 1 : -1;
    return b.finalScore - a.finalScore;
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
    await enrichSignals(signals, opts); // Website/IG anreichern (best-effort, gebudgetet)
    const leads = sortLeads(signals.map((s) => toLead(s, opts)));
    return { leads, errors: [] };
  } catch (e) {
    return { leads: [], errors: [(e as Error).message] };
  }
}
