import type { Einstufung, PipelineStatus } from "./types";

// ====================================================================
// Notion-Property-Namen (zentrale Konstante)
// --------------------------------------------------------------------
// Diese Namen muessen exakt den Spaltennamen in der Notion-Datenbank
// entsprechen. Wenn du eine bestehende Datenbank nutzt, passe NUR
// diese Werte an, der restliche Code zieht sich daraus.
// ====================================================================
export const NOTION_PROPS = {
  name: "Name", // Title
  status: "Status", // Select
  rating: "Bewertung", // Select (HOT/WARM/COLD)
  score: "Score", // Number
  need: "Bedarf", // Number
  pay: "Zahlungskraft", // Number
  fit: "Fit", // Number
  branch: "Branche", // Rich Text (alternativ Select, siehe README)
  instagram: "Instagram", // URL
  phone: "Telefon", // Phone (alternativ Text)
  website: "Website", // URL
  address: "Adresse", // Rich Text
  googleMaps: "Google Maps", // URL
  reviewCount: "Anzahl Bewertungen", // Number
  notes: "Notizen", // Rich Text
  addedAt: "Hinzugefügt am", // Date
} as const;

/** Reihenfolge der Pipeline-Spalten im Board. */
export const PIPELINE_STATUSES: PipelineStatus[] = [
  "Neu",
  "Angeschrieben",
  "In Kontakt",
  "Termin",
  "Kunde",
  "Abgelehnt",
];

export const RATINGS: Einstufung[] = ["IN_NEED", "INTERESTED", "COMMON", "RAUS"];

/** Oberindikator-Farben (Pins, Badges): IN NEED rot, INTERESTED orange, COMMON blau. */
export const RATING_COLORS: Record<Einstufung, string> = {
  IN_NEED: "#DA5B4A",
  INTERESTED: "#D9913F",
  COMMON: "#6E8FB0",
  RAUS: "#46464A",
};

/** Anzeige-Labels fuer den Oberindikator (Underscore -> Leerzeichen). */
export const EINSTUFUNG_LABEL: Record<Einstufung, string> = {
  IN_NEED: "IN NEED",
  INTERESTED: "INTERESTED",
  COMMON: "COMMON",
  RAUS: "RAUS",
};

export const STATUS_COLORS: Record<PipelineStatus, string> = {
  Neu: "#39ff8b",
  Angeschrieben: "#ffb000",
  "In Kontakt": "#c79a5b",
  Termin: "#37c0ff",
  Kunde: "#7dffb6",
  Abgelehnt: "#7a5a5a",
};

// ---- App-Konfiguration ----
export const APP_CONFIG = {
  /** Standard-Kartenzentrum (Region des Nutzers: Giessen / Laubach). */
  DEFAULT_CENTER: { lat: 50.5841, lng: 8.6784 },
  DEFAULT_ZOOM: 11,
  DEFAULT_RADIUS_KM: 5,
  MIN_RADIUS_KM: 1,
  MAX_RADIUS_KM: 25,
  /** Scan-Cache-Lebensdauer in ms (24h). Identische Suchen loesen keinen neuen Call aus. */
  CACHE_TTL_MS: 24 * 60 * 60 * 1000,
  /** Maximale Anzahl Websites pro Anreicherungs-Batch (Schutz der Ziel-Server). */
  ENRICH_BATCH_MAX: 12,
  /** Maximale Ergebnisse pro Kategorie-Call (Google-Limit ist 20). */
  MAX_RESULTS_PER_CATEGORY: 20,
  // ---- Instagram-Enrichment (Apify) ----
  /** IG-Profile pro Handle 3 Wochen cachen (localStorage), spart Apify-Calls. */
  IG_CACHE_TTL_MS: 21 * 24 * 60 * 60 * 1000,
  /** Nur "verfolgenswerte" Leads bekommen einen IG-Call (Kapital + Fit). */
  IG_CANDIDATE_PAY: 45,
  IG_CANDIDATE_FIT: 50,
};

// ---- Zahlungskraft-Filter (Slider 1..5) ----
// Mindest-Zahlungskraft (pay_score), ab der ein Lead noch angezeigt wird.
// Stufe 1 = alle, Stufe 5 = nur sehr hohe Zahlungskraft.
export const PAY_FILTER = {
  THRESHOLDS: { 1: 0, 2: 25, 3: 45, 4: 65, 5: 80 } as Record<number, number>,
  LABELS: {
    1: "alle",
    2: "ab niedrig",
    3: "ab mittel",
    4: "ab hoch",
    5: "nur sehr hoch",
  } as Record<number, string>,
};

// ---- localStorage Keys ----
export const STORAGE_KEYS = {
  requestCount: "lr_request_count",
  scanCache: "lr_scan_cache",
  ui: "lr_ui_state",
  enrichCache: "lr_enrich_cache",
  googleCache: "lr_google_cache",
  instaCache: "lr_insta_cache_v3",
  booted: "lr_booted",
};
