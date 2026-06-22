// ====================================================================
// LEAD REASONING ENGINE v2  (das Herzstueck, signalbasiert)
// --------------------------------------------------------------------
// Kernregel (NICHT wegoptimieren): Es ist ein Signal-Problem, kein
// Reasoning-Problem. Die Engine bewertet AUSSCHLIESSLICH Signale, die real
// in den Daten stehen. Alles andere wird als "im Erstkontakt pruefen"
// (Status "unbekannt") ausgegeben und NIE gescort. Kein Feld wird
// geschaetzt, geraten oder erfunden.
//
// Pipeline: 1) KO-Filter -> 2) Substanz-Score (nur scrapebare Signale)
//           -> 3) Tier (aus Kategorie) -> 4) HOT/WARM/COLD -> 5) Output.
// ====================================================================

// ====================================================================
// KONFIG  (oben halten, leicht tunebar)
// ====================================================================
export const REASONING_CONFIG = {
  MIN_REVIEWS_ALLGEMEIN: 15,
  MIN_REVIEWS_AUTO_OHNE_MARKE: 30,
  MIN_RATING: 3.8,
  // "wenige Reviews" fuer die Rating-KO-Regel (schwaches Rating + wenig Volumen)
  WENIGE_REVIEWS: 20,

  // Substanz-Schwellen fuer HOT / WARM (0..100)
  SUBSTANZ_HOT: 80,
  SUBSTANZ_WARM_MIN: 45,

  // Review-Volumen-Skalierung fuer die finanzielle Substanz. Weniger gesaettigt:
  // erst hohe Reviewzahlen erreichen Top-Werte -> etablierte Betriebe heben sich
  // klar von der Masse ab (Kalibrierung Simon: HOT strenger).
  REVIEW_SCALE_MIN: 20, // <= ergibt 0
  REVIEW_SCALE_MAX: 300, // >= ergibt 100

  // Gewichte INNERHALB der finanziellen Substanz (Reviews staerker gewichtet).
  FIN_WEIGHTS: { marke: 0.2, reviews: 0.4, preis: 0.1, domain: 0.2, fotos: 0.1 },

  // Fast-Food / Imbiss / Doener: HARTE KO (Entscheidung Simon). Erkennung ueber
  // das echte Google-Signal primaryType, plus eindeutige Namensbegriffe.
  FAST_FOOD_TYPES: ["fast_food_restaurant", "meal_takeaway", "meal_delivery"],
  FAST_FOOD_NAMEN: [
    "doener", "döner", "imbiss", "kebab", "kebap", "duerum", "dürüm",
    "currywurst", "snackbar", "schnellrestaurant", "grill-station",
    "pizza-taxi", "pizzaservice", "pizzabringdienst",
  ],

  // Auto: echte Vertragsmarke (Premium zaehlt staerker, siehe PREMIUM_AUTO_MARKEN)
  PREMIUM_AUTO_MARKEN: [
    "Porsche", "Mercedes", "Mercedes-Benz", "Audi", "BMW",
    "Volkswagen Zentrum", "Jaguar", "Land Rover", "Volvo", "Lexus", "Tesla",
  ],
  // ANNAHME (gekennzeichnet): "Vertragsmarke" != nur Premium. Diese Marken im
  // Namen heben das Auto ueber die "Mini-Autohuette"-Schwelle, zaehlen aber
  // schwaecher als Premium.
  VERTRAGS_AUTO_MARKEN: [
    "Volkswagen", "VW", "Opel", "Ford", "Toyota", "Renault", "Peugeot",
    "Citroen", "Skoda", "Seat", "Hyundai", "Kia", "Mazda", "Nissan",
    "Fiat", "Mitsubishi", "Suzuki", "Dacia", "Honda", "Mini", "Cupra",
  ],

  KETTEN_BLACKLIST: [
    "Lidl", "Aldi", "Edeka", "Rewe", "Netto", "Penny", "Kaufland",
    "McDonald", "Burger King", "Subway", "Starbucks", "Filiale", "Niederlassung",
    "wirkaufendeinauto", "wir kaufen dein auto", "wir kaufen ihr auto",
  ],

  DIENSTLEISTUNG_OHNE_ANKER: [
    "Versicherung", "Steuerberatung", "Steuerberater", "Callcenter",
    "Hausverwaltung", "Inkasso",
  ],

  // ANNAHME (gekennzeichnet): Hosts, die KEINE eigene Website sind (= Aggregator).
  AGGREGATOR_HOSTS: [
    "mobile.de", "autoscout24", "facebook.com", "fb.com", "instagram.com",
    "linktr.ee", "google.com", "business.site", "yelp.", "11880.com",
    "gelbeseiten", "das-oertliche", "tripadvisor",
  ],

  // --- PAIN-MATCH (zweite Achse) -----------------------------------
  // Zweite Bewertungsachse NEBEN der Einstufung. Misst, wie VIEL ein Lead
  // als Retainer wert ist und ob er durch Simons Content-Leistung loesbar
  // ist - AUSSCHLIESSLICH aus real vorhandenen Signalen. Kapital ist der
  // Kern (Preislevel, Groesse via Review-Volumen, Auto-Marke, Branche).
  // Der konkrete ANLASS (Launch/Event/Recruiting) steht NICHT in Places-
  // Daten -> bleibt "unbekannt" (Erstkontakt), wird NIE erfunden.
  PAIN_MATCH: {
    KAPITAL_HOCH: 65, // Kapital-Score (0..100) ab hier "hoch"
    KAPITAL_MITTEL: 40, // ab hier "mittel"
    LOESBAR_MIN: 45, // visuell-darstellbar-Score, ab dem es durch Content loesbar ist
    // Review-Volumen als Groessen-/Kapital-Proxy
    KAPITAL_REVIEW_MIN: 30, // <= ergibt 0
    KAPITAL_REVIEW_MAX: 400, // >= ergibt 100
    // Gewichte INNERHALB des Kapital-Scores (ueber vorhandene renormiert)
    WEIGHTS: { preis: 0.35, groesse: 0.35, marke: 0.15, branche: 0.15 },
  },

  // Branchen-Kapitalintensitaet (immer aus Kategorie ableitbar -> Default-Signal).
  KAPITAL_BRANCHE_HOCH: [
    "hotel", "resort", "lodging", "autohaus", "car_dealer", "kfz",
    "immobilien", "estate", "maschinenbau", "klinik", "zahnarzt", "dentist",
    "bauunternehmen", "moebel", "möbel", "kuechen", "küchen", "ingenieur", "spa",
  ],
  KAPITAL_BRANCHE_MITTEL: [
    "restaurant", "gastro", "bar", "fitness", "studio", "beauty", "kosmetik",
    "friseur", "praxis", "physio", "yoga", "event", "location", "tattoo",
  ],
} as const;

// ====================================================================
// EIN- / AUSGABE-TYPEN
// ====================================================================

/** Normalisierte, REAL vorhandene Signale eines Business. null/undefined = unbekannt. */
export interface BusinessSignals {
  name: string;
  /** Menschenlesbare Kategorie (z.B. "Autohaus", "Hotel"). */
  categoryLabel: string;
  /** Optionale interne Kategorie-id (aus categories.ts), wenn vorhanden. */
  categoryId?: string;
  /** Rohe Typ-Strings (z.B. Google place types) zur Tier/Visuell-Ableitung. */
  types?: string[];

  rating?: number | null;
  reviewCount?: number | null;
  /** 0..4 (Google PRICE_LEVEL_*). null = unbekannt. */
  priceLevel?: number | null;
  photoCount?: number | null;

  website?: string | null;
  /** Verlinkter Social-Account bekannt? true/false = geprueft, null = unbekannt. */
  hasSocial?: boolean | null;

  phone?: string | null;
  address?: string | null;
  lat?: number;
  lng?: number;
}

export type Tier = "A" | "B" | "C";
export type Einstufung = "HOT" | "WARM" | "COLD" | "RAUS";
export type Empfehlung = "kontaktieren" | "spaeter" | "raus";
export type CheckStatus = "unbekannt";

/** Zweite Achse: wie viel ist der Lead als Retainer wert + ist er loesbar. */
export type PainMatch = "hoch" | "mittel" | "niedrig";

export interface PainMatchResult {
  level: PainMatch;
  /** Kapital-Einschaetzung 0..100 (Kern der Achse). */
  kapital_score: number;
  /** Treibende Kapital-Signale (real vorhanden). */
  kapital_signale: string[];
  /** Durch Simons Content-Leistung loesbar (aus visuell-darstellbar). */
  loesbar: boolean;
  /** Konkreter Anlass/Phase nicht aus Scan-Daten ableitbar -> Erstkontakt. */
  anlass_status: "unbekannt";
  begruendung: string;
}

export interface Teilscore {
  score: number;
  signale: string[];
  begruendung: string;
}

export interface QualifiedLead {
  name: string;
  tier: Tier;
  tier_c_on_hold: boolean;
  einstufung: Einstufung;
  substanz_score: number;
  /** Zweite Achse: Kapital x Loesbarkeit (neben der Einstufung). */
  pain_match: PainMatchResult;
  ko_ausgeschlossen: boolean;
  ko_grund: string | null;
  scrapebare_bewertung: {
    finanzielle_substanz: Teilscore;
    visuell_darstellbar: Teilscore;
    schmerzpunkt: Teilscore;
  };
  im_erstkontakt_pruefen: {
    entscheider_erreichbar: CheckStatus;
    gesicht_zeigen: CheckStatus;
    langfristig: CheckStatus;
    chaos_signale: CheckStatus;
  };
  kontakt: { telefon: string; website: string; adresse: string };
  empfehlung: Empfehlung;
  begruendung_kurz: string;
}

// ====================================================================
// HELFER  (reine Signal-Pruefungen, kein Raten)
// ====================================================================
const norm = (s: string) => s.toLowerCase();
const C = REASONING_CONFIG;

function nameContainsAny(name: string, list: readonly string[]): string | null {
  const n = norm(name);
  for (const term of list) if (n.includes(norm(term))) return term;
  return null;
}

/** Volles Heuhaufen inkl. Google-Typen (fuer Auto/Visuell). */
function categoryHay(s: BusinessSignals): string {
  return norm([s.categoryLabel, s.categoryId ?? "", ...(s.types ?? [])].join(" "));
}

/** NUR das saubere categoryLabel/categoryId - ohne verrauschte Google-Typen.
 *  Fuer das Tier-Matching, damit Typen wie "sports_activity_location" nicht
 *  faelschlich TIER_A-Keywords ("location") treffen. */
function labelHay(s: BusinessSignals): string {
  return norm([s.categoryLabel, s.categoryId ?? ""].join(" "));
}

function isChain(s: BusinessSignals): string | null {
  return nameContainsAny(s.name, C.KETTEN_BLACKLIST);
}

function isAnkerlosDienstleistung(s: BusinessSignals): string | null {
  // Sowohl im Namen als auch in der Kategorie pruefen (OSM kennt diese
  // Kategorien teils nicht -> Name faengt sie ab).
  const inName = nameContainsAny(s.name, C.DIENSTLEISTUNG_OHNE_ANKER);
  if (inName) return inName;
  const hay = categoryHay(s);
  for (const term of C.DIENSTLEISTUNG_OHNE_ANKER) {
    if (hay.includes(norm(term))) return term;
  }
  // Google-Typen fuer Anker-lose Dienstleistung
  const TYPE_HINT = ["insurance_agency", "accounting", "lawyer", "finance"];
  for (const t of TYPE_HINT) if (hay.includes(t)) return t;
  return null;
}

function isFastFood(s: BusinessSignals): string | null {
  const types = (s.types ?? []).map(norm);
  for (const t of C.FAST_FOOD_TYPES) if (types.includes(t)) return t;
  return nameContainsAny(s.name, C.FAST_FOOD_NAMEN);
}

function isAuto(s: BusinessSignals): boolean {
  const hay = categoryHay(s);
  return (
    /autohaus|gebrauchtwagen|kfz|car_dealer|auto/.test(hay) ||
    /autohaus|gebrauchtwagen|automobil|kfz/.test(norm(s.name))
  );
}

/** "premium" | "vertrag" | null  -- nur aus dem Namen, kein Raten. */
function autoMarke(s: BusinessSignals): "premium" | "vertrag" | null {
  if (nameContainsAny(s.name, C.PREMIUM_AUTO_MARKEN)) return "premium";
  if (nameContainsAny(s.name, C.VERTRAGS_AUTO_MARKEN)) return "vertrag";
  return null;
}

function websiteHost(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** true = eigene Domain, false = Aggregator-Link, null = keine Website bekannt. */
function hasOwnDomain(url?: string | null): boolean | null {
  const host = websiteHost(url);
  if (!host) return null;
  for (const agg of C.AGGREGATOR_HOSTS) if (host.includes(norm(agg))) return false;
  return true;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/** Optionen, die einzelne KO-Regeln umschaltbar machen (z.B. Ketten-Filter). */
export interface QualifyOptions {
  /** Ketten/Filialen als KO ausschliessen. Default true. */
  filterChains?: boolean;
}

// ====================================================================
// STUFE 1: KO-FILTER  (harte Ausschluesse, ein Treffer -> RAUS)
// ====================================================================
export function runKO(s: BusinessSignals, opts?: QualifyOptions): string | null {
  // 1) Kette (umschaltbar)
  if (opts?.filterChains !== false) {
    const chain = isChain(s);
    if (chain) return `Kette/Filiale erkannt ("${chain}") - kein lokales Budget, langer Entscheidungsweg`;
  }

  // 1b) Fast-Food / Imbiss / Doener (harte KO, Entscheidung Simon)
  const ff = isFastFood(s);
  if (ff) return `Fast-Food/Imbiss erkannt ("${ff}") - niedrige Zahlungskraft, kein Retainer-Budget`;

  // 2) Anker-lose Dienstleistung
  const anker = isAnkerlosDienstleistung(s);
  if (anker) return `Dienstleistung ohne visuellen Anker ("${anker}") - kein Content-Material`;

  // 3) Auto-Spezialfall ZUERST (strenger als die Allgemein-Regel)
  if (isAuto(s)) {
    const marke = autoMarke(s);
    const reviews = s.reviewCount;
    if (!marke && typeof reviews === "number" && reviews < C.MIN_REVIEWS_AUTO_OHNE_MARKE) {
      return `keine Vertragsmarke und unter ${C.MIN_REVIEWS_AUTO_OHNE_MARKE} Reviews (${reviews}) - Mini-Autohuette`;
    }
    // Ohne Marke UND ohne bekannte Reviewzahl + ohne eigene Website = ebenfalls raus
    if (!marke && reviews == null && hasOwnDomain(s.website) !== true) {
      return "keine Vertragsmarke, keine Reviewzahl und keine eigene Website - keine Substanz";
    }
  }

  // 4) Keine Website UND wenige Reviews
  const hasWeb = hasOwnDomain(s.website) === true; // Aggregator zaehlt NICHT als Website
  if (!hasWeb && typeof s.reviewCount === "number" && s.reviewCount < C.MIN_REVIEWS_ALLGEMEIN) {
    return `keine eigene Website und unter ${C.MIN_REVIEWS_ALLGEMEIN} Reviews (${s.reviewCount}) - keine Substanz`;
  }

  // 5) Schwaches Rating bei gleichzeitig wenig Volumen
  if (
    typeof s.rating === "number" &&
    s.rating < C.MIN_RATING &&
    typeof s.reviewCount === "number" &&
    s.reviewCount < C.WENIGE_REVIEWS
  ) {
    return `Rating ${s.rating} unter ${C.MIN_RATING} bei nur ${s.reviewCount} Reviews - schwaches Geschaeft`;
  }

  return null;
}

// ====================================================================
// STUFE 2: SUBSTANZ-SCORE  (nur scrapebare Signale, 0..100)
// --------------------------------------------------------------------
// Jeder Teil scort NUR vorhandene Signale. Fehlende Signale fliessen NICHT
// in die Wertung ein (Gewichte werden ueber die vorhandenen renormiert).
// ====================================================================

interface SubSignal {
  key: string;
  weight: number;
  value: number | null; // null = unbekannt -> nicht werten
  label: string; // fuer signale[]
}

function weightedPresent(subs: SubSignal[]): { score: number; signale: string[]; unbekannt: string[] } {
  const present = subs.filter((x) => x.value != null);
  const signale: string[] = [];
  const unbekannt: string[] = [];
  for (const x of subs) {
    if (x.value == null) unbekannt.push(x.key);
    else signale.push(`${x.label} (${round(x.value)})`);
  }
  if (present.length === 0) return { score: 50, signale, unbekannt }; // nichts bekannt -> neutral
  const wSum = present.reduce((a, x) => a + x.weight, 0);
  const score = present.reduce((a, x) => a + x.weight * (x.value as number), 0) / wSum;
  return { score: round(clamp(score)), signale, unbekannt };
}

function scoreFinanzielleSubstanz(s: BusinessSignals): Teilscore {
  const subs: SubSignal[] = [];

  const W = C.FIN_WEIGHTS;

  // Marke (nur bei Auto ein echtes Signal; sonst nicht anwendbar -> unbekannt)
  if (isAuto(s)) {
    const m = autoMarke(s);
    subs.push({
      key: "marke",
      weight: W.marke,
      value: m === "premium" ? 100 : m === "vertrag" ? 65 : 0,
      label: m === "premium" ? "Premium-Marke" : m === "vertrag" ? "Vertragsmarke" : "keine Marke",
    });
  }

  // Review-Anzahl: REVIEW_SCALE_MIN -> 0, REVIEW_SCALE_MAX -> 100 (weniger gesaettigt)
  const rMin = C.REVIEW_SCALE_MIN;
  const rMax = C.REVIEW_SCALE_MAX;
  subs.push({
    key: "reviews",
    weight: W.reviews,
    value: typeof s.reviewCount === "number" ? clamp(((s.reviewCount - rMin) / (rMax - rMin)) * 100) : null,
    label: `${s.reviewCount ?? "?"} Reviews`,
  });

  // Preislevel 0..4 -> 0..100
  subs.push({
    key: "preis",
    weight: W.preis,
    value: typeof s.priceLevel === "number" ? clamp((s.priceLevel / 4) * 100) : null,
    label: `Preislevel ${s.priceLevel ?? "?"}`,
  });

  // Eigene Domain vs Aggregator
  const own = hasOwnDomain(s.website);
  subs.push({
    key: "domain",
    weight: W.domain,
    value: own == null ? null : own ? 100 : 20,
    label: own == null ? "Website unbekannt" : own ? "eigene Domain" : "nur Aggregator-Link",
  });

  // Anzahl Fotos: 0 -> 0, 10+ -> 100 (Foto-Anzahl ist gedeckelt -> geringes Gewicht)
  subs.push({
    key: "fotos",
    weight: W.fotos,
    value: typeof s.photoCount === "number" ? clamp((s.photoCount / 10) * 100) : null,
    label: `${s.photoCount ?? "?"} Fotos`,
  });

  const { score, signale, unbekannt } = weightedPresent(subs);
  const begruendung =
    `Getrieben durch: ${signale.join(", ") || "keine harten Signale"}.` +
    (unbekannt.length ? ` Unbekannt (nicht gewertet): ${unbekannt.join(", ")}.` : "");
  return { score, signale, begruendung };
}

// Visuell darstellbar: rein aus Kategorie/Typ ableitbar (immer vorhanden).
const VISUELL_HOCH = ["hotel", "resort", "event", "location", "restaurant", "gastro",
  "bar", "cafe", "club", "spa", "beauty", "kosmetik", "studio", "fitness",
  "friseur", "autohaus", "car_dealer", "lodging", "tourism"];
const VISUELL_NIEDRIG = ["versicherung", "steuer", "kanzlei", "lawyer", "insurance",
  "accounting", "callcenter", "inkasso", "hausverwaltung", "consulting",
  "software", "saas", "edv", "agentur"];

function scoreVisuell(s: BusinessSignals): Teilscore {
  const hay = categoryHay(s);
  let score = 55; // neutraler Default
  let why = "neutral (Kategorie nicht eindeutig)";
  if (VISUELL_HOCH.some((k) => hay.includes(k))) {
    score = 88;
    why = "Raum/Produkt/Erlebnis als Anker vorhanden";
  } else if (VISUELL_NIEDRIG.some((k) => hay.includes(k))) {
    score = 28;
    why = "reine Dienstleistung ohne Raum oder Produkt";
  }
  return { score, signale: [s.categoryLabel], begruendung: why };
}

// Schmerzpunkt: schwaches Signal. Nur "Social-Account verlinkt?" ist scrapebar.
function scoreSchmerz(s: BusinessSignals): Teilscore {
  if (s.hasSocial === false) {
    return {
      score: 65,
      signale: ["kein verlinkter Social-Account"],
      begruendung: "moeglicher Sichtbarkeits-Schmerz (schwaches Signal)",
    };
  }
  if (s.hasSocial === true) {
    return {
      score: 35,
      signale: ["Social-Account vorhanden"],
      begruendung: "bereits sichtbar (schwaches Signal)",
    };
  }
  return {
    score: 50,
    signale: [],
    begruendung: "Social-Status unbekannt -> neutral, nicht gewertet (schwaches Signal)",
  };
}

function combineSubstanz(fin: Teilscore, vis: Teilscore, schmerz: Teilscore): number {
  return round(clamp(0.5 * fin.score + 0.35 * vis.score + 0.15 * schmerz.score));
}

// ====================================================================
// PAIN-MATCH (zweite Achse): Kapital x Loesbarkeit, nur reale Signale
// --------------------------------------------------------------------
// Kapital = wie viel Budget steckt erkennbar dahinter (Preislevel,
// Groesse via Review-Volumen, Auto-Marke, Branchen-Kapitalintensitaet).
// Loesbar = laesst sich der Bedarf durch Simons Content abbilden (visuell).
// Der konkrete Anlass (Launch/Event/Recruiting) ist NICHT scrapebar und
// bleibt "unbekannt" -> Erstkontakt. Wird nie geraten.
// ====================================================================

/** Branchen-Kapitalintensitaet aus der Kategorie (immer ableitbar). */
function brancheKapital(s: BusinessSignals): { value: number; label: string } {
  const hay = categoryHay(s);
  if (C.KAPITAL_BRANCHE_HOCH.some((k) => hay.includes(k)))
    return { value: 85, label: "kapitalintensive Branche" };
  if (C.KAPITAL_BRANCHE_MITTEL.some((k) => hay.includes(k)))
    return { value: 55, label: "mittlere Branchen-Kapitalkraft" };
  return { value: 35, label: "Branche eher kapitalschwach" };
}

function scoreKapital(s: BusinessSignals): { score: number; signale: string[] } {
  const W = C.PAIN_MATCH.WEIGHTS;
  const subs: SubSignal[] = [];

  // Preislevel: staerkstes direktes Kapital-/Zahlungskraft-Signal
  subs.push({
    key: "preis",
    weight: W.preis,
    value: typeof s.priceLevel === "number" ? clamp((s.priceLevel / 4) * 100) : null,
    label: `Preislevel ${s.priceLevel ?? "?"}`,
  });

  // Review-Volumen als Groessen-/Etabliertheits-Proxy (Kapital folgt Groesse)
  const kMin = C.PAIN_MATCH.KAPITAL_REVIEW_MIN;
  const kMax = C.PAIN_MATCH.KAPITAL_REVIEW_MAX;
  subs.push({
    key: "groesse",
    weight: W.groesse,
    value: typeof s.reviewCount === "number" ? clamp(((s.reviewCount - kMin) / (kMax - kMin)) * 100) : null,
    label: `Groesse ${s.reviewCount ?? "?"} Reviews`,
  });

  // Auto-Marke (nur bei Auto ein echtes Kapital-Signal)
  if (isAuto(s)) {
    const m = autoMarke(s);
    subs.push({
      key: "marke",
      weight: W.marke,
      value: m === "premium" ? 100 : m === "vertrag" ? 65 : 25,
      label: m === "premium" ? "Premium-Automarke" : m === "vertrag" ? "Vertragsmarke" : "freie Werkstatt",
    });
  }

  // Branchen-Kapitalintensitaet (immer vorhanden)
  const bk = brancheKapital(s);
  subs.push({ key: "branche", weight: W.branche, value: bk.value, label: bk.label });

  const { score, signale } = weightedPresent(subs);
  return { score, signale };
}

function painMatchEinstufung(kapital: number, loesbar: boolean): PainMatch {
  const P = C.PAIN_MATCH;
  // Nicht durch Content loesbar (reine Dienstleistung ohne Raum/Produkt) -> nie hoch.
  if (!loesbar) return kapital >= P.KAPITAL_HOCH ? "mittel" : "niedrig";
  if (kapital >= P.KAPITAL_HOCH) return "hoch";
  if (kapital >= P.KAPITAL_MITTEL) return "mittel";
  return "niedrig";
}

function computePainMatch(s: BusinessSignals, visuell: number): PainMatchResult {
  const { score: kapital, signale } = scoreKapital(s);
  const loesbar = visuell >= C.PAIN_MATCH.LOESBAR_MIN;
  const level = painMatchEinstufung(kapital, loesbar);
  const begruendung =
    `Kapital ${kapital}/100 (${signale.join(", ") || "keine harten Signale"}); ` +
    `${loesbar ? "durch Content loesbar" : "kaum durch Content loesbar"}. ` +
    `Konkreter Anlass/Phase nicht aus Scan-Daten ableitbar -> im Erstkontakt pruefen.`;
  return {
    level,
    kapital_score: kapital,
    kapital_signale: signale,
    loesbar,
    anlass_status: "unbekannt",
    begruendung,
  };
}

// ====================================================================
// STUFE 3: TIER  (aus Kategorie)
// ====================================================================
const TIER_A = ["hotel", "resort", "event", "location", "restaurant", "gastro",
  "bar", "cafe", "club", "lodging", "conference"];
const TIER_B = ["beauty", "kosmetik", "friseur", "hairdresser", "fitness", "studio",
  "spa", "yoga", "coach", "physio", "zahnarzt", "dentist", "praxis", "tattoo"];
// Hinweis: KEINE ultrakurzen Keywords wie "it" -> matcht als Teilstring
// faelschlich in "f-it-ness". Stattdessen eindeutige Begriffe.
const TIER_C = ["autohaus", "auto", "car_dealer", "kfz", "anwalt", "lawyer", "kanzlei",
  "steuer", "accounting", "versicherung", "insurance", "immobilien", "estate",
  "maschinenbau", "software", "saas", "edv", "b2b", "ingenieur", "recruiting",
  "bauunternehmen"];

function assignTier(s: BusinessSignals): Tier {
  const hay = labelHay(s); // nur sauberes Label, keine Google-Typen
  // Tier B vor A pruefen: lokale Dienstleister (Fitness/Studio/Beauty) gehen
  // sonst ueber Begriffe wie "studio"/"event" faelschlich nach A.
  if (TIER_C.some((k) => hay.includes(k))) return "C";
  if (TIER_B.some((k) => hay.includes(k))) return "B";
  if (TIER_A.some((k) => hay.includes(k))) return "A";
  return "B"; // unklarer lokaler Dienstleister -> B (nicht A, nicht C)
}

// ====================================================================
// STUFE 4: HOT / WARM / COLD
// --------------------------------------------------------------------
// Bezieht sich AUSDRUECKLICH nur auf die scrapebaren Dimensionen.
// Tier C wird nie HOT (Strategie: auf Eis) -> max WARM, on hold, "spaeter".
// (Aufloesung des Spec-Widerspruchs ueber das Worked Example: Porsche = WARM.)
// ====================================================================
function einstufen(tier: Tier, substanz: number): Einstufung {
  if (tier === "C") {
    return substanz >= C.SUBSTANZ_WARM_MIN ? "WARM" : "COLD";
  }
  if (substanz >= C.SUBSTANZ_HOT) return "HOT";
  if (substanz >= C.SUBSTANZ_WARM_MIN) return "WARM";
  return "COLD";
}

// ====================================================================
// STUFE 5: OUTPUT  (qualify = eine Funktion pro Business)
// ====================================================================
export function qualify(s: BusinessSignals, opts?: QualifyOptions): QualifiedLead {
  const base: Omit<QualifiedLead, "tier" | "tier_c_on_hold" | "einstufung" | "substanz_score" | "pain_match" | "scrapebare_bewertung" | "empfehlung" | "begruendung_kurz"> & {
    tier: Tier;
  } = {
    name: s.name,
    tier: "B",
    ko_ausgeschlossen: false,
    ko_grund: null,
    im_erstkontakt_pruefen: {
      entscheider_erreichbar: "unbekannt",
      gesicht_zeigen: "unbekannt",
      langfristig: "unbekannt",
      chaos_signale: "unbekannt",
    },
    kontakt: {
      telefon: s.phone ?? "",
      website: s.website ?? "",
      adresse: s.address ?? "",
    },
  };

  const tier = assignTier(s);
  const tierCOnHold = tier === "C";

  // STUFE 1: KO -> sofort raus, keine weitere Bewertung
  const ko = runKO(s, opts);
  if (ko) {
    return {
      ...base,
      tier,
      tier_c_on_hold: tierCOnHold,
      einstufung: "RAUS",
      substanz_score: 0,
      pain_match: {
        level: "niedrig",
        kapital_score: 0,
        kapital_signale: [],
        loesbar: false,
        anlass_status: "unbekannt",
        begruendung: "nicht bewertet (KO)",
      },
      ko_ausgeschlossen: true,
      ko_grund: ko,
      scrapebare_bewertung: {
        finanzielle_substanz: { score: 0, signale: [], begruendung: "nicht bewertet (KO)" },
        visuell_darstellbar: { score: 0, signale: [], begruendung: "nicht bewertet (KO)" },
        schmerzpunkt: { score: 0, signale: [], begruendung: "nicht bewertet (KO)" },
      },
      empfehlung: "raus",
      begruendung_kurz: `RAUS: ${ko}.`,
    };
  }

  // STUFE 2: Substanz
  const fin = scoreFinanzielleSubstanz(s);
  const vis = scoreVisuell(s);
  const schmerz = scoreSchmerz(s);
  const substanz = combineSubstanz(fin, vis, schmerz);

  // STUFE 4: Einstufung
  const einstufung = einstufen(tier, substanz);

  // Zweite Achse: Pain-Match (Kapital x Loesbarkeit)
  const pain_match = computePainMatch(s, vis.score);

  // Empfehlung
  let empfehlung: Empfehlung;
  if (tierCOnHold) empfehlung = "spaeter";
  else if (einstufung === "HOT" || einstufung === "WARM") empfehlung = "kontaktieren";
  else empfehlung = "spaeter";

  const begruendung_kurz =
    (tierCOnHold
      ? `Tier C (Strategie: auf Eis). Substanz ${substanz}/100 ${substanz >= C.SUBSTANZ_WARM_MIN ? "stimmt" : "schwach"}, daher ${einstufung}, "spaeter".`
      : `Tier ${tier}, Substanz ${substanz}/100 -> ${einstufung}.`) +
    " Bewertung nur auf scrapebaren Signalen; Erreichbarkeit/Langfristigkeit unbekannt.";

  return {
    ...base,
    tier,
    tier_c_on_hold: tierCOnHold,
    einstufung,
    substanz_score: substanz,
    pain_match,
    scrapebare_bewertung: {
      finanzielle_substanz: fin,
      visuell_darstellbar: vis,
      schmerzpunkt: schmerz,
    },
    empfehlung,
    begruendung_kurz,
  };
}
