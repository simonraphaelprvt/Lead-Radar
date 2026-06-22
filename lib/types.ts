// ====================================================================
// Zentrale Typen fuer Lead Radar
// --------------------------------------------------------------------
// Seit Reasoning-Engine v2: ein Lead traegt die signalbasierte Bewertung
// (einstufung/tier/substanz/ko) direkt. Die alten pay/need/fit-Scores sind
// entfallen (sie beruhten auf geratenen Branchenwerten).
// ====================================================================

import type {
  Tier,
  Einstufung,
  Empfehlung,
  CheckStatus,
  Teilscore,
  PainSignal,
  PainWeight,
} from "./reasoning";

export type { Tier, Einstufung, Empfehlung, CheckStatus, Teilscore, PainSignal, PainWeight };

export type PipelineStatus =
  | "Neu"
  | "Angeschrieben"
  | "Termin"
  | "Kunde"
  | "Abgelehnt";

/**
 * Instagram-Anreicherungszustand:
 *  - undefined  = noch nicht geprueft
 *  - null       = geprueft, kein Account gefunden
 *  - string     = gefundener Profil-Link
 */
export type InstagramState = string | null | undefined;

/** Ein gefundenes Business inkl. signalbasierter Bewertung. Zentrale Datenstruktur. */
export interface Lead {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;

  // ---- Kontakt / Anzeige (real aus den Daten) ----
  website?: string;
  phone?: string;
  googleMapsUri?: string;
  openingHours?: string[];
  /** Website-Vorschaubild (og:image), per Anreicherung. */
  imageUrl?: string | null;
  /** Standort-Foto (Google Place/Street View), Proxy-URL. undefined = noch nicht geholt. */
  photoUrl?: string | null;
  instagram?: InstagramState;

  // ---- Rohsignale, die in die Bewertung geflossen sind ----
  categoryLabel: string;
  rating?: number | null;
  reviewCount?: number | null;
  priceLevel?: number | null;
  photoCount?: number | null;
  types?: string[];

  // ---- Reasoning-Engine v3 (Oberindikator) ----
  einstufung: Einstufung; // IN_NEED | INTERESTED | COMMON | RAUS  (EINZIGER Indikator)
  tier: Tier; // A | B | C  (nur Liste/Detail)
  tierCOnHold: boolean; // off-profile (fit unter Gate)
  /** Rohachsen 0..100 - Begruendung hinter dem Oberindikator (Liste/Detail). */
  payScore: number;
  needScore: number;
  fitScore: number;
  painMatchScore: number;
  finalScore: number;
  /** Jedes Pain-Signal einzeln (gefunden / nicht / nicht pruefbar) mit Beleg. */
  painSignals: PainSignal[];
  koAusgeschlossen: boolean;
  koGrund: string | null;
  empfehlung: Empfehlung; // kontaktieren | spaeter | raus
  begruendungKurz: string;
  /** Die drei Rohachsen mit treibenden Signalen. */
  achsen: {
    pay: Teilscore;
    need: Teilscore;
    fit: Teilscore;
  };
  /** Checkliste "im Erstkontakt pruefen" - immer "unbekannt", nie gescort. */
  erstkontakt: {
    entscheider_erreichbar: CheckStatus;
    gesicht_zeigen: CheckStatus;
    langfristig: CheckStatus;
    chaos_signale: CheckStatus;
  };

  /** Manueller Haken: "sucht aktiv Social-Media-Personal". */
  indeedFlag?: boolean;

  // ---- Pipeline-Felder (gesetzt, sobald in Notion) ----
  notionPageId?: string;
  status?: PipelineStatus;
  notes?: string;
  addedAt?: string; // ISO
}

/** Request-Payload an /api/scan */
export interface ScanRequest {
  lat: number;
  lng: number;
  radiusKm: number;
  categories: string[];
  /** Ketten/Filialen als KO ausschliessen (Default true). */
  filterChains?: boolean;
}

/** Response von /api/scan */
export interface ScanResponse {
  leads: Lead[];
  count: number;
  errors: string[];
}

/** Outreach-Ergebnis (KI- oder Template-Modus) */
export interface OutreachResult {
  mode: "ai" | "template";
  contentIdea: string;
  dm: string;
  email: string;
}
