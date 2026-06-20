// ====================================================================
// LEAD-SCORING-MODELL  (das Herzstueck)
// --------------------------------------------------------------------
// Grundregel:
//   Bedarf allein macht keinen heissen Lead.
//   Zahlungskraft wirkt als Bremse.
//   Ein Business mit hohem Bedarf aber niedriger Zahlungskraft
//   (Imbiss, Doener, Kiosk) wird nie HOT und faellt auf COLD.
//
// Jedes Business bekommt drei Teil-Scores 0..100:
//   pay  (Zahlungskraft) - aus Branche, priceLevel, Groesse (reviewCount)
//   need (Bedarf)        - fehlende Website/Instagram, etabliert ohne Auftritt
//   fit  (Branchen-Fit)  - Eignung als Social-Media-Retainer-Kunde
//
// Daraus folgt die Gesamtbewertung HOT / WARM / COLD.
//
// ALLE Gewichte und Schwellen stehen als Konstanten in SCORING_CONFIG
// und sind bewusst leicht aenderbar gehalten.
// ====================================================================

import type { LeadRating, LeadScore, ScoreInput } from "./types";
import { getCategory } from "./categories";

export const SCORING_CONFIG = {
  // ---- Gesamtbewertung: Gates und Schwellen ----
  /** Unter diesem Fit kann ein Lead maximal COLD werden (Fit ist ein Gate). */
  FIT_GATE: 60,
  /** Unter dieser Zahlungskraft immer COLD (die "Bremse" fuer Imbiss/Doener/Kiosk). */
  PAY_COLD_CEILING: 40,

  /** HOT nur, wenn ALLE drei Bedingungen erfuellt sind. */
  HOT: { pay: 65, need: 50, fit: 60 },
  /** Eine Achse gilt als "stark" ab diesen Werten. */
  STRONG: { pay: 60, need: 50, fit: 60 },
  /** WARM, wenn mindestens so viele Achsen "stark" sind (und nicht HOT). */
  WARM_MIN_STRONG_AXES: 2,

  // ---- need_score (Bedarf) ----
  NEED_BASE: 45,
  NEED_NO_WEBSITE: 35, // keine Website = starkes Bedarfs-Signal
  NEED_NO_INSTAGRAM: 18, // geprueft, kein Instagram trotz Geschaeft
  NEED_HAS_INSTAGRAM: -12, // hat bereits Instagram-Auftritt
  NEED_ESTABLISHED_NO_WEB: 15, // viele Bewertungen UND keine Website = idealer Lead
  NEED_LOW_RATING: 8, // schwacher Schnitt trotz vieler Bewertungen
  NEED_INDEED_FLAG: 20, // manuell: sucht aktiv Social-Media-Personal
  /** Ab so vielen Bewertungen gilt ein Laden als "etabliert". */
  ESTABLISHED_REVIEWS: 40,
  /** Unter diesem Schnitt zaehlt die Bewertung als schwach. */
  LOW_RATING_THRESHOLD: 3.9,

  // ---- pay_score (Zahlungskraft) Anpassungen innerhalb der Tier-Spanne ----
  PRICE_DELTA: {
    PRICE_LEVEL_FREE: -12,
    PRICE_LEVEL_INEXPENSIVE: -8,
    PRICE_LEVEL_MODERATE: 0,
    PRICE_LEVEL_EXPENSIVE: 10,
    PRICE_LEVEL_VERY_EXPENSIVE: 16,
  } as Record<string, number>,
  REVIEWS_PAY_HIGH: 8, // etabliert (Groesse) hebt Zahlungskraft leicht
  REVIEWS_PAY_LOW: -10, // sehr wenige Bewertungen senkt
  REVIEWS_LOW_THRESHOLD: 8,
};

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

// --------------------------------------------------------------------
// Achse 1: Zahlungskraft (pay_score)
// --------------------------------------------------------------------
export function computePayScore(input: ScoreInput): number {
  const cat = getCategory(input.categoryId);
  let p = cat.payBase;

  // priceLevel hebt/senkt
  if (input.priceLevel) {
    p += SCORING_CONFIG.PRICE_DELTA[input.priceLevel] ?? 0;
  }

  // reviewCount als grober Groessen-Indikator - nur einbeziehen, wenn der Wert
  // wirklich bekannt ist. (OpenStreetMap liefert keine Bewertungsanzahl;
  // fehlende Daten duerfen nicht wie "wenige Bewertungen" wirken.)
  if (typeof input.reviewCount === "number") {
    if (input.reviewCount >= SCORING_CONFIG.ESTABLISHED_REVIEWS) {
      p += SCORING_CONFIG.REVIEWS_PAY_HIGH;
    }
    if (input.reviewCount <= SCORING_CONFIG.REVIEWS_LOW_THRESHOLD) {
      p += SCORING_CONFIG.REVIEWS_PAY_LOW;
    }
  }

  // Tier-Grenzen halten: garantiert, dass niedrige Branchen niedrig bleiben.
  return Math.round(clamp(p, cat.payMin, cat.payMax));
}

// --------------------------------------------------------------------
// Achse 2: Bedarf (need_score)
// --------------------------------------------------------------------
export function computeNeedScore(input: ScoreInput): number {
  const C = SCORING_CONFIG;
  let n = C.NEED_BASE;

  const reviews = input.reviewCount ?? 0;
  const established = reviews >= C.ESTABLISHED_REVIEWS;
  const hasWebsite = !!input.website;

  if (!hasWebsite) n += C.NEED_NO_WEBSITE;

  // Instagram-Zustand: null = geprueft & nicht gefunden, string = vorhanden
  if (input.instagram === null) n += C.NEED_NO_INSTAGRAM;
  else if (typeof input.instagram === "string") n += C.NEED_HAS_INSTAGRAM;

  // Etabliert (viele Bewertungen) aber ohne modernen Online-Auftritt = idealer Lead
  if (established && !hasWebsite) n += C.NEED_ESTABLISHED_NO_WEB;

  if (established && (input.rating ?? 5) < C.LOW_RATING_THRESHOLD) {
    n += C.NEED_LOW_RATING;
  }

  if (input.indeedFlag) n += C.NEED_INDEED_FLAG;

  return Math.round(clamp(n));
}

// --------------------------------------------------------------------
// Achse 3: Branchen-Fit (fit_score)
// --------------------------------------------------------------------
export function computeFitScore(input: ScoreInput): number {
  return Math.round(clamp(getCategory(input.categoryId).fit));
}

// --------------------------------------------------------------------
// Gesamt-Score (0..100): Bedarf, multipliziert mit Zahlungskraft, verrechnet mit Fit.
// --------------------------------------------------------------------
export function computeFinalScore(pay: number, need: number, fit: number): number {
  const payMult = 0.3 + 0.7 * (pay / 100); // Zahlungskraft als Multiplikator
  const fitMult = 0.6 + 0.4 * (fit / 100); // Fit als sanfter Faktor
  return Math.round(clamp(need * payMult * fitMult));
}

// --------------------------------------------------------------------
// Gesamtbewertung HOT / WARM / COLD
// --------------------------------------------------------------------
export function rateLead(pay: number, need: number, fit: number): LeadRating {
  const C = SCORING_CONFIG;

  // Gate 1: zu geringer Fit -> maximal COLD
  if (fit < C.FIT_GATE) return "COLD";
  // Gate 2: zu geringe Zahlungskraft -> immer COLD (die Bremse)
  if (pay < C.PAY_COLD_CEILING) return "COLD";

  // HOT: alle drei Bedingungen
  if (pay >= C.HOT.pay && need >= C.HOT.need && fit >= C.HOT.fit) return "HOT";

  // WARM: stark in mindestens zwei Achsen
  const strongAxes =
    (pay >= C.STRONG.pay ? 1 : 0) +
    (need >= C.STRONG.need ? 1 : 0) +
    (fit >= C.STRONG.fit ? 1 : 0);
  if (strongAxes >= C.WARM_MIN_STRONG_AXES) return "WARM";

  return "COLD";
}

// --------------------------------------------------------------------
// Hauptfunktion: liefert alle Teil-Scores + Gesamtbewertung.
// --------------------------------------------------------------------
export function scoreLead(input: ScoreInput): LeadScore {
  const pay = computePayScore(input);
  const need = computeNeedScore(input);
  const fit = computeFitScore(input);
  const final = computeFinalScore(pay, need, fit);
  const rating = rateLead(pay, need, fit);
  return { pay, need, fit, final, rating };
}
