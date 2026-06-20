// ====================================================================
// Zentrale Typen fuer Lead Radar
// ====================================================================

export type LeadRating = "HOT" | "WARM" | "COLD";

export type PipelineStatus =
  | "Neu"
  | "Angeschrieben"
  | "Termin"
  | "Kunde"
  | "Abgelehnt";

/**
 * Instagram-Anreicherungszustand:
 *  - undefined  = noch nicht geprueft
 *  - null       = geprueft, kein Account gefunden (ehrlich "nicht gefunden", nie raten)
 *  - string     = gefundener Profil-Link
 */
export type InstagramState = string | null | undefined;

/** Die drei Teil-Scores plus Gesamtbewertung. */
export interface LeadScore {
  /** Zahlungskraft 0..100 */
  pay: number;
  /** Bedarf 0..100 */
  need: number;
  /** Branchen-Fit 0..100 */
  fit: number;
  /** Gesamt-Score 0..100 */
  final: number;
  rating: LeadRating;
}

/** Ein gefundenes Business inklusive Bewertung. Zentrale Datenstruktur der App. */
export interface Lead {
  id: string; // Google Place ID
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number; // Google Sterne-Schnitt
  reviewCount?: number;
  website?: string;
  phone?: string;
  googleMapsUri?: string;
  primaryType?: string;
  primaryTypeDisplay?: string;
  priceLevel?: string; // z.B. "PRICE_LEVEL_EXPENSIVE"
  openingHours?: string[];
  businessStatus?: string; // "OPERATIONAL" etc.

  categoryId: string; // Suchkategorie (Treiber fuer Branche/Scoring)
  branchLabel: string; // menschenlesbare Branche

  instagram?: InstagramState;
  /** Manueller Haken: "sucht aktiv Social-Media-Personal" (extern recherchiert). Hebt den Score an. */
  indeedFlag?: boolean;

  score: LeadScore;

  // Pipeline-Felder (gesetzt, sobald in Notion)
  notionPageId?: string;
  status?: PipelineStatus;
  notes?: string;
  addedAt?: string; // ISO
}

/** Eingabe fuer das Scoring-Modul. */
export interface ScoreInput {
  categoryId: string;
  priceLevel?: string;
  reviewCount?: number;
  rating?: number;
  website?: string | null;
  instagram?: InstagramState;
  indeedFlag?: boolean;
}

/** Request-Payload an /api/places */
export interface PlacesRequest {
  lat: number;
  lng: number;
  radiusKm: number;
  categories: string[];
}

/** Response von /api/places */
export interface PlacesResponse {
  leads: Lead[];
  requestCount: number; // Anzahl tatsaechlicher Google-API-Calls
  errors: string[];
}

/** Outreach-Ergebnis (KI- oder Template-Modus) */
export interface OutreachResult {
  mode: "ai" | "template";
  contentIdea: string;
  dm: string;
  email: string;
}
