import type { LeadRating, PipelineStatus } from "./types";

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
  "Termin",
  "Kunde",
  "Abgelehnt",
];

export const RATINGS: LeadRating[] = ["HOT", "WARM", "COLD"];

/** Farben fuer die Bewertungen (Pins, Badges). Spiegeln tailwind.config wider. */
export const RATING_COLORS: Record<LeadRating, string> = {
  HOT: "#ff3b3b",
  WARM: "#ffb000",
  COLD: "#6f8f80",
};

export const STATUS_COLORS: Record<PipelineStatus, string> = {
  Neu: "#39ff8b",
  Angeschrieben: "#ffb000",
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
};

// ---- localStorage Keys ----
export const STORAGE_KEYS = {
  requestCount: "lr_request_count",
  scanCache: "lr_scan_cache",
  ui: "lr_ui_state",
  enrichCache: "lr_enrich_cache",
  booted: "lr_booted",
};
