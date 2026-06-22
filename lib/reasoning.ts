// ====================================================================
// LEAD REASONING ENGINE v3  (Oberindikator: IN NEED / INTERESTED / COMMON)
// --------------------------------------------------------------------
// Kernregel (NICHT wegoptimieren): Es ist ein Signal-Problem. Die Engine
// bewertet AUSSCHLIESSLICH Signale, die real in den Daten stehen. Alles
// andere wird als "im Erstkontakt pruefen" ausgegeben und NIE gescort.
// Kein Feld wird geschaetzt, geraten oder erfunden.
//
// Pipeline pro Business:
//   1) KO-Filter (ein Treffer -> RAUS)
//   2) pay_score / need_score / fit_score (Rohachsen, 0..100)
//   3) Pain-Signale: jedes einzeln, an einem konkreten Datenpunkt belegt
//      -> pain_match_score (gewichtete Summe der GEFUNDENEN Signale)
//   4) Verrechnung:
//        zwischen = need * (0.5 + 0.5 * pain/100)        (Pain verstaerkt Need)
//        final    = zwischen * (0.3 + 0.7 * pay/100)      (Pay als Gate+Multipl.)
//      fit < Gate -> max COMMON.
//   5) EINZIGER Oberindikator: IN_NEED / INTERESTED / COMMON (+ RAUS via KO).
//      Rohwerte wandern in Liste/Detail, NICHT auf die Karte.
// ====================================================================

// ====================================================================
// KONFIG  (oben halten, leicht tunebar)
// ====================================================================
export const REASONING_CONFIG = {
  MIN_REVIEWS_ALLGEMEIN: 15,
  MIN_REVIEWS_AUTO_OHNE_MARKE: 30,
  MIN_RATING: 3.8,
  WENIGE_REVIEWS: 20,

  // Review-Volumen-Skalierung als Groessen-/Etabliertheits-Proxy.
  REVIEW_SCALE_MIN: 20, // <= ergibt 0
  REVIEW_SCALE_MAX: 300, // >= ergibt 100

  // Ab wievielen Reviews gilt ein Betrieb als "etabliert" (fuer Pain-Signal
  // 'etabliert aber unsichtbar').
  ETABLIERT_REVIEWS: 80,

  // Fast-Food / Imbiss / Doener: HARTE KO.
  FAST_FOOD_TYPES: ["fast_food_restaurant", "meal_takeaway", "meal_delivery"],
  FAST_FOOD_NAMEN: [
    "doener", "döner", "imbiss", "kebab", "kebap", "duerum", "dürüm",
    "currywurst", "snackbar", "schnellrestaurant", "grill-station",
    "pizza-taxi", "pizzaservice", "pizzabringdienst",
  ],

  PREMIUM_AUTO_MARKEN: [
    "Porsche", "Mercedes", "Mercedes-Benz", "Audi", "BMW",
    "Volkswagen Zentrum", "Jaguar", "Land Rover", "Volvo", "Lexus", "Tesla",
  ],
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

  AGGREGATOR_HOSTS: [
    "mobile.de", "autoscout24", "facebook.com", "fb.com", "instagram.com",
    "linktr.ee", "google.com", "business.site", "yelp.", "11880.com",
    "gelbeseiten", "das-oertliche", "tripadvisor",
  ],

  // --- ZAHLUNGSKRAFT (pay_score) : Branchen-Startwerte ---------------
  // pay_score = Branchen-Basis gemischt mit Preislevel + Groesse (Reviews).
  PAY_BRANCHE_HOCH: [
    "autohaus", "car_dealer", "kfz", "zahnarzt", "dentist", "arzt", "praxis",
    "klinik", "anwalt", "lawyer", "kanzlei", "steuer", "immobilien", "estate",
    "hotel", "resort", "lodging", "nachtclub", "diskothek", "club", "bau",
    "kosmetik", "beauty", "spa", "moebel", "möbel", "kuechen", "küchen",
    "maschinenbau", "ingenieur", "premium",
  ],
  PAY_BRANCHE_MITTEL: [
    "restaurant", "gastro", "cafe", "café", "bar", "friseur", "boutique",
    "mode", "fitness", "studio", "event", "location", "physio", "yoga",
    "tattoo", "eventlocation",
  ],
  PAY_BRANCHE_NIEDRIG: [
    "imbiss", "doener", "döner", "kiosk", "spaeti", "späti", "baeckerei",
    "bäckerei", "snack",
  ],
  PAY_BASE: { hoch: 88, mittel: 58, niedrig: 25, default: 45 },

  // --- FIT (fit_score) : Passung zu Simons Kernbranchen ---------------
  // Kern: Gastronomie, Automotive, Nightlife, Fitness, Hospitality.
  FIT_CORE: [
    "restaurant", "gastro", "cafe", "café", "bar", "hotel", "resort", "lodging",
    "nachtclub", "diskothek", "club", "fitness", "studio", "autohaus", "auto",
    "car_dealer", "kfz", "event", "location", "spa", "eventlocation",
  ],
  FIT_ADJACENT: [
    "beauty", "kosmetik", "friseur", "immobilien", "estate", "boutique", "mode",
    "einzelhandel", "retail", "praxis", "zahnarzt", "dentist", "tattoo",
    "moebel", "möbel", "kuechen", "küchen", "physio", "yoga",
  ],
  FIT_OFF: [
    "versicherung", "steuer", "anwalt", "lawyer", "kanzlei", "software", "saas",
    "edv", "b2b", "recruiting", "consulting", "inkasso", "hausverwaltung",
    "accounting", "ingenieur", "maschinenbau",
  ],
  FIT_BASE: { core: 92, adjacent: 62, off: 22, default: 45 },
  FIT_GATE: 40, // fit darunter -> maximal COMMON

  // --- NEED (need_score) : grobe, branchenbasierte Bedarfssignale -----
  NEED_BASE: 45,
  NEED_KEINE_WEBSITE: 30, // own domain fehlt
  NEED_ETABLIERT_UNSICHTBAR: 10,
  NEED_REINE_DIENSTLEISTUNG: -15,

  // --- PAIN-SIGNALE : Gewichtspunkte je gefundenem Signal -------------
  PAIN_WEIGHTS: { hoch: 45, mittel: 25, niedrig: 12 } as Record<PainWeight, number>,
  // Tage ohne Instagram-Post, ab denen "inaktiv" gilt.
  IG_INAKTIV_TAGE: 75,

  // Branchen mit bekanntem Fachkraeftemangel (mittleres Pain-Gewicht).
  FACHKRAEFTEMANGEL_BRANCHE: [
    "gastro", "restaurant", "cafe", "café", "bar", "hotel", "pflege", "klinik",
    "handwerk", "bau", "bauunternehmen", "friseur", "kfz", "elektro", "sanitaer",
    "sanitär",
  ],
  // Produkt-/verkaufsbasierte Branchen (brauchen Sichtbarkeit fuers Produkt).
  PRODUKT_BRANCHE: [
    "autohaus", "car_dealer", "kfz", "boutique", "mode", "einzelhandel",
    "retail", "moebel", "möbel", "kuechen", "küchen", "immobilien", "estate",
    "e-commerce", "shop",
  ],

  // --- OBERINDIKATOR-SCHWELLEN (scharf) -------------------------------
  IN_NEED: { FINAL: 65, PAY: 65, FIT: 60 }, // + >=1 belegtes High-Weight-Pain
  INTERESTED: { FINAL: 40, FIT: 50 },
} as const;

// ====================================================================
// EIN- / AUSGABE-TYPEN
// ====================================================================

/** Normalisierte, REAL vorhandene Signale eines Business. null/undefined = unbekannt. */
export interface BusinessSignals {
  name: string;
  categoryLabel: string;
  categoryId?: string;
  types?: string[];

  rating?: number | null;
  reviewCount?: number | null;
  priceLevel?: number | null;
  photoCount?: number | null;

  website?: string | null;
  hasSocial?: boolean | null;

  phone?: string | null;
  address?: string | null;
  lat?: number;
  lng?: number;

  // ---- Enrichment (Layer 2, optional; server-seitig befuellt) ----
  /** Website per Fetch erreichbar? null/undefined = nicht geprueft. */
  siteReachable?: boolean | null;
  siteHttps?: boolean | null;
  /** viewport-Meta vorhanden (Indiz fuer responsive)? */
  siteResponsive?: boolean | null;
  /** erkannter Baukasten (wix/jimdo/...) oder null. */
  siteBuilder?: string | null;
  /** Auf der Website verlinktes Instagram-Handle (ohne @) oder null. */
  instagramHandle?: string | null;
  /** Instagram ueberhaupt geprueft (Website gefetcht)? */
  igChecked?: boolean;
  /** Tage seit letztem Instagram-Post; null = nicht ermittelbar. */
  igLastPostDaysAgo?: number | null;
}

export type Tier = "A" | "B" | "C";
/** EINZIGER Oberindikator (Karte). RAUS kommt aus dem KO-Filter. */
export type Einstufung = "IN_NEED" | "INTERESTED" | "COMMON" | "RAUS";
export type Empfehlung = "kontaktieren" | "spaeter" | "raus";
export type CheckStatus = "unbekannt";

export type PainWeight = "hoch" | "mittel" | "niedrig";

/** Ein einzeln geprueftes Pain-Signal, an einem konkreten Datenpunkt belegt. */
export interface PainSignal {
  key: string;
  label: string;
  weight: PainWeight;
  /** gefunden = Punkt vergeben. */
  found: boolean;
  /** war das Signal aus den Daten ueberhaupt pruefbar? false -> Erstkontakt. */
  pruefbar: boolean;
  /** konkreter Datenpunkt (Beleg) bzw. warum nicht pruefbar. */
  beleg: string;
}

/** Eine Rohachse mit Score + treibenden Signalen. */
export interface Teilscore {
  score: number;
  signale: string[];
  begruendung: string;
}

export interface QualifiedLead {
  name: string;
  tier: Tier;
  /** Off-Profil (fit unter Gate) -> deutlich zurueckgestuft. */
  tier_c_on_hold: boolean;
  /** EINZIGER Oberindikator. */
  einstufung: Einstufung;

  // Rohachsen (0..100) - Begruendung, wandern in Liste/Detail.
  pay_score: number;
  need_score: number;
  fit_score: number;
  pain_match_score: number;
  final_score: number;

  pay: Teilscore;
  need: Teilscore;
  fit: Teilscore;
  /** Jedes Pain-Signal einzeln (gefunden/nicht/ nicht pruefbar) mit Beleg. */
  pain_signals: PainSignal[];

  ko_ausgeschlossen: boolean;
  ko_grund: string | null;
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

function categoryHay(s: BusinessSignals): string {
  return norm([s.categoryLabel, s.categoryId ?? "", ...(s.types ?? [])].join(" "));
}
function labelHay(s: BusinessSignals): string {
  return norm([s.categoryLabel, s.categoryId ?? ""].join(" "));
}
function hayHasAny(hay: string, list: readonly string[]): boolean {
  return list.some((k) => hay.includes(norm(k)));
}

function isChain(s: BusinessSignals): string | null {
  return nameContainsAny(s.name, C.KETTEN_BLACKLIST);
}

function isAnkerlosDienstleistung(s: BusinessSignals): string | null {
  const inName = nameContainsAny(s.name, C.DIENSTLEISTUNG_OHNE_ANKER);
  if (inName) return inName;
  const hay = categoryHay(s);
  for (const term of C.DIENSTLEISTUNG_OHNE_ANKER) if (hay.includes(norm(term))) return term;
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
function scaleReviews(reviews: number, min: number, max: number): number {
  return clamp(((reviews - min) / (max - min)) * 100);
}

export interface QualifyOptions {
  /** Ketten/Filialen als KO ausschliessen. Default true. */
  filterChains?: boolean;
}

// ====================================================================
// STUFE 1: KO-FILTER  (harte Ausschluesse, ein Treffer -> RAUS)
// ====================================================================
export function runKO(s: BusinessSignals, opts?: QualifyOptions): string | null {
  if (opts?.filterChains !== false) {
    const chain = isChain(s);
    if (chain) return `Kette/Filiale erkannt ("${chain}") - kein lokales Budget, langer Entscheidungsweg`;
  }
  const ff = isFastFood(s);
  if (ff) return `Fast-Food/Imbiss erkannt ("${ff}") - niedrige Zahlungskraft, kein Retainer-Budget`;

  const anker = isAnkerlosDienstleistung(s);
  if (anker) return `Dienstleistung ohne visuellen Anker ("${anker}") - kein Content-Material`;

  if (isAuto(s)) {
    const marke = autoMarke(s);
    const reviews = s.reviewCount;
    if (!marke && typeof reviews === "number" && reviews < C.MIN_REVIEWS_AUTO_OHNE_MARKE) {
      return `keine Vertragsmarke und unter ${C.MIN_REVIEWS_AUTO_OHNE_MARKE} Reviews (${reviews}) - Mini-Autohuette`;
    }
    if (!marke && reviews == null && hasOwnDomain(s.website) !== true) {
      return "keine Vertragsmarke, keine Reviewzahl und keine eigene Website - keine Substanz";
    }
  }

  const hasWeb = hasOwnDomain(s.website) === true;
  if (!hasWeb && typeof s.reviewCount === "number" && s.reviewCount < C.MIN_REVIEWS_ALLGEMEIN) {
    return `keine eigene Website und unter ${C.MIN_REVIEWS_ALLGEMEIN} Reviews (${s.reviewCount}) - keine Substanz`;
  }

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
// STUFE 2: ROHACHSEN  pay / need / fit  (0..100)
// ====================================================================

/** Zahlungskraft: Branchen-Basis gemischt mit Preislevel + Groesse (Reviews). */
function scorePay(s: BusinessSignals): Teilscore {
  const hay = categoryHay(s);
  let base: number = C.PAY_BASE.default;
  let label = "Branche neutral";
  if (hayHasAny(hay, C.PAY_BRANCHE_HOCH)) { base = C.PAY_BASE.hoch; label = "kapitalstarke Branche"; }
  else if (hayHasAny(hay, C.PAY_BRANCHE_NIEDRIG)) { base = C.PAY_BASE.niedrig; label = "kapitalschwache Branche"; }
  else if (hayHasAny(hay, C.PAY_BRANCHE_MITTEL)) { base = C.PAY_BASE.mittel; label = "mittlere Branchen-Kapitalkraft"; }

  // Auto-Marke hebt die Basis (Premium > Vertrag).
  if (isAuto(s)) {
    const m = autoMarke(s);
    if (m === "premium") { base = Math.max(base, 92); label = "Premium-Automarke"; }
    else if (m === "vertrag") { base = Math.max(base, 75); label = "Vertrags-Automarke"; }
  }

  const parts: { w: number; v: number }[] = [{ w: 0.5, v: base }];
  const signale: string[] = [label];
  if (typeof s.priceLevel === "number") {
    parts.push({ w: 0.3, v: clamp((s.priceLevel / 4) * 100) });
    signale.push(`Preislevel ${s.priceLevel}`);
  }
  if (typeof s.reviewCount === "number") {
    parts.push({ w: 0.2, v: scaleReviews(s.reviewCount, C.REVIEW_SCALE_MIN, C.REVIEW_SCALE_MAX) });
    signale.push(`${s.reviewCount} Reviews`);
  }
  const wSum = parts.reduce((a, p) => a + p.w, 0);
  const score = round(clamp(parts.reduce((a, p) => a + p.w * p.v, 0) / wSum));
  return { score, signale, begruendung: `Zahlungskraft aus ${signale.join(", ")}.` };
}

const VISUELL_NIEDRIG = ["versicherung", "steuer", "kanzlei", "lawyer", "insurance",
  "accounting", "callcenter", "inkasso", "hausverwaltung", "consulting",
  "software", "saas", "edv", "agentur"];

/** Bedarf (grob, branchenbasiert): fehlende/aggregierte Website + etabliert-unsichtbar. */
function scoreNeed(s: BusinessSignals): Teilscore {
  let score = C.NEED_BASE;
  const signale: string[] = [];
  const own = hasOwnDomain(s.website);
  if (own !== true) {
    score += C.NEED_KEINE_WEBSITE;
    signale.push(own === false ? "nur Aggregator-Link" : "keine eigene Website");
    if (typeof s.reviewCount === "number" && s.reviewCount >= C.ETABLIERT_REVIEWS) {
      score += C.NEED_ETABLIERT_UNSICHTBAR;
      signale.push(`etabliert (${s.reviewCount} Reviews) aber unsichtbar`);
    }
  } else {
    signale.push("eigene Website vorhanden");
  }
  // Kein moderner Online-Auftritt (aus Enrichment): generische/veraltete Praesenz
  // erhoeht den Bedarf - genau "generische Website / ohne modernen Auftritt".
  if (s.siteBuilder) { score += 12; signale.push(`${s.siteBuilder}-Baukasten`); }
  if (s.igChecked === true && !s.instagramHandle) { score += 15; signale.push("keine Instagram-Praesenz"); }
  if (typeof s.igLastPostDaysAgo === "number" && s.igLastPostDaysAgo > C.IG_INAKTIV_TAGE) {
    score += 12; signale.push(`Instagram inaktiv (${s.igLastPostDaysAgo}d)`);
  }
  if (s.siteResponsive === false) { score += 8; signale.push("nicht responsive"); }

  if (hayHasAny(categoryHay(s), VISUELL_NIEDRIG)) {
    score += C.NEED_REINE_DIENSTLEISTUNG;
    signale.push("reine Dienstleistung (geringerer Content-Bedarf)");
  }
  return { score: round(clamp(score)), signale, begruendung: `Bedarf aus ${signale.join(", ")}.` };
}

/** Fit: Passung zu Simons Kernbranchen (rein aus Kategorie). */
function scoreFit(s: BusinessSignals): Teilscore {
  const hay = categoryHay(s);
  if (hayHasAny(hay, C.FIT_OFF))
    return { score: C.FIT_BASE.off, signale: [s.categoryLabel], begruendung: "ausserhalb des Kernprofils (B2B/Kanzlei/Tech)" };
  if (hayHasAny(hay, C.FIT_CORE))
    return { score: C.FIT_BASE.core, signale: [s.categoryLabel], begruendung: "Kernbranche (Gastro/Auto/Nightlife/Fitness/Hospitality)" };
  if (hayHasAny(hay, C.FIT_ADJACENT))
    return { score: C.FIT_BASE.adjacent, signale: [s.categoryLabel], begruendung: "angrenzende Branche" };
  return { score: C.FIT_BASE.default, signale: [s.categoryLabel], begruendung: "Branche nicht eindeutig" };
}

// ====================================================================
// STUFE 3: PAIN-SIGNALE  (jedes einzeln, an einem Datenpunkt belegt)
// --------------------------------------------------------------------
// Kein Signal aus Vermutung. Ist die Datenlage zu duenn -> pruefbar=false,
// found=false (kein Punkt), Beleg verweist auf den Erstkontakt.
// ====================================================================
function computePainSignals(s: BusinessSignals): PainSignal[] {
  const own = hasOwnDomain(s.website); // true | false | null
  const host = websiteHost(s.website);
  const reviews = s.reviewCount;
  const reviewsKnown = typeof reviews === "number";
  const etabliert = reviewsKnown && (reviews as number) >= C.ETABLIERT_REVIEWS;
  const hay = categoryHay(s);
  const produkt = hayHasAny(hay, C.PRODUKT_BRANCHE);
  const fachk = hayHasAny(hay, C.FACHKRAEFTEMANGEL_BRANCHE);

  const sig: PainSignal[] = [];

  // 1) Keine eigene Website (hoch) - aus Places immer pruefbar.
  sig.push({
    key: "keine_website",
    label: "Keine eigene Website",
    weight: "hoch",
    pruefbar: true,
    found: own !== true,
    beleg:
      own === false ? `nur Aggregator-Link (${host ?? "?"})`
      : own === null ? "kein websiteUri im Google-Profil"
      : "eigene Domain vorhanden",
  });

  // 2) Etabliert, aber unsichtbar (hoch).
  sig.push({
    key: "etabliert_unsichtbar",
    label: "Etabliert aber unsichtbar",
    weight: "hoch",
    pruefbar: reviewsKnown,
    found: etabliert && own !== true,
    beleg: reviewsKnown
      ? `${reviews} Reviews${own !== true ? ", aber keine eigene Website" : ", Website vorhanden"}`
      : "Reviewzahl unbekannt",
  });

  // 3) Produkt-/Verkaufsgeschaeft ohne Sichtbarkeit (hoch).
  sig.push({
    key: "produkt_ohne_sichtbarkeit",
    label: "Produkt ohne Sichtbarkeit",
    weight: "hoch",
    pruefbar: true,
    found: produkt && own !== true,
    beleg: produkt
      ? own !== true ? "Produkt-/Verkaufsgeschaeft ohne eigene Web-Praesenz" : "Produktgeschaeft mit Website"
      : "kein Produkt-/Verkaufsgeschaeft",
  });

  // 4) Fachkraeftemangel-Branche (mittel).
  sig.push({
    key: "fachkraeftemangel_branche",
    label: "Fachkraeftemangel-Branche",
    weight: "mittel",
    pruefbar: true,
    found: fachk,
    beleg: fachk ? "Branche mit bekanntem Fachkraeftemangel" : "Branche ohne typischen Fachkraeftemangel",
  });

  // 5) Keine Instagram-Praesenz (hoch) - nur pruefbar, wenn Website gefetcht.
  const igChecked = s.igChecked === true;
  sig.push({
    key: "keine_instagram_praesenz",
    label: "Keine Instagram-Praesenz",
    weight: "hoch",
    pruefbar: igChecked,
    found: igChecked && !s.instagramHandle,
    beleg: igChecked
      ? s.instagramHandle ? `Instagram verlinkt (@${s.instagramHandle})` : "Website ohne Instagram-Verlinkung"
      : "Instagram nicht geprueft (Enrichment aus) -> Erstkontakt",
  });

  // 6) Instagram inaktiv (hoch) - nur pruefbar mit Last-Post-Datum.
  const igDays = s.igLastPostDaysAgo;
  const igDaysKnown = typeof igDays === "number";
  sig.push({
    key: "instagram_inaktiv",
    label: "Instagram inaktiv",
    weight: "hoch",
    pruefbar: igDaysKnown,
    found: igDaysKnown && (igDays as number) > C.IG_INAKTIV_TAGE,
    beleg: igDaysKnown
      ? `letzter Post vor ${igDays} Tagen`
      : "IG-Aktivitaet nicht ermittelbar -> Erstkontakt",
  });

  // 7) Website veraltet/generisch (niedrig) - nur pruefbar mit Site-Fetch.
  const siteOk = s.siteReachable === true;
  const veraltetGruende: string[] = [];
  if (siteOk) {
    if (s.siteHttps === false) veraltetGruende.push("kein HTTPS");
    if (s.siteResponsive === false) veraltetGruende.push("kein responsive-Viewport");
    if (s.siteBuilder) veraltetGruende.push(`${s.siteBuilder}-Baukasten`);
  }
  sig.push({
    key: "website_veraltet",
    label: "Website veraltet/generisch",
    weight: "niedrig",
    pruefbar: siteOk,
    found: siteOk && veraltetGruende.length > 0,
    beleg: siteOk
      ? veraltetGruende.length ? veraltetGruende.join(", ") : "Website wirkt aktuell/responsive"
      : "Website-Technik nicht geprueft -> Erstkontakt",
  });

  return sig;
}

function painScore(signals: PainSignal[]): number {
  const sum = signals.reduce((a, x) => (x.found ? a + C.PAIN_WEIGHTS[x.weight] : a), 0);
  return clamp(sum);
}
function hasHighWeightPain(signals: PainSignal[]): boolean {
  return signals.some((x) => x.found && x.weight === "hoch");
}

// ====================================================================
// STUFE 4: VERRECHNUNG + OBERINDIKATOR
// ====================================================================
function verrechnen(pay: number, need: number, pain: number): number {
  const zwischen = need * (0.5 + 0.5 * (pain / 100));
  const final = zwischen * (0.3 + 0.7 * (pay / 100));
  return round(clamp(final));
}

function einstufen(
  pay: number, fit: number, final: number, highPain: boolean,
): Einstufung {
  if (fit < C.FIT_GATE) return "COMMON"; // fit-Gate: off-profile nie hoch
  if (final >= C.IN_NEED.FINAL && pay >= C.IN_NEED.PAY && fit >= C.IN_NEED.FIT && highPain) return "IN_NEED";
  if (final >= C.INTERESTED.FINAL && fit >= C.INTERESTED.FIT) return "INTERESTED";
  return "COMMON";
}

// ====================================================================
// TIER (nur noch fuer Liste/Detail, NICHT mehr Karte)
// ====================================================================
const TIER_A = ["hotel", "resort", "event", "location", "restaurant", "gastro",
  "bar", "cafe", "club", "lodging", "conference"];
const TIER_B = ["beauty", "kosmetik", "friseur", "hairdresser", "fitness", "studio",
  "spa", "yoga", "coach", "physio", "zahnarzt", "dentist", "praxis", "tattoo"];
const TIER_C = ["autohaus", "auto", "car_dealer", "kfz", "anwalt", "lawyer", "kanzlei",
  "steuer", "accounting", "versicherung", "insurance", "immobilien", "estate",
  "maschinenbau", "software", "saas", "edv", "b2b", "ingenieur", "recruiting",
  "bauunternehmen"];

function assignTier(s: BusinessSignals): Tier {
  const hay = labelHay(s);
  if (TIER_C.some((k) => hay.includes(k))) return "C";
  if (TIER_B.some((k) => hay.includes(k))) return "B";
  if (TIER_A.some((k) => hay.includes(k))) return "A";
  return "B";
}

// ====================================================================
// STUFE 5: OUTPUT  (qualify = eine Funktion pro Business)
// ====================================================================
export function qualify(s: BusinessSignals, opts?: QualifyOptions): QualifiedLead {
  const tier = assignTier(s);
  const base = {
    name: s.name,
    tier,
    ko_ausgeschlossen: false,
    ko_grund: null as string | null,
    im_erstkontakt_pruefen: {
      entscheider_erreichbar: "unbekannt" as const,
      gesicht_zeigen: "unbekannt" as const,
      langfristig: "unbekannt" as const,
      chaos_signale: "unbekannt" as const,
    },
    kontakt: { telefon: s.phone ?? "", website: s.website ?? "", adresse: s.address ?? "" },
  };

  // STUFE 1: KO -> sofort RAUS
  const ko = runKO(s, opts);
  if (ko) {
    const leer: Teilscore = { score: 0, signale: [], begruendung: "nicht bewertet (KO)" };
    return {
      ...base,
      tier_c_on_hold: false,
      einstufung: "RAUS",
      pay_score: 0, need_score: 0, fit_score: 0, pain_match_score: 0, final_score: 0,
      pay: leer, need: leer, fit: leer,
      pain_signals: [],
      ko_ausgeschlossen: true,
      ko_grund: ko,
      empfehlung: "raus",
      begruendung_kurz: `RAUS: ${ko}.`,
    };
  }

  // STUFE 2: Rohachsen
  const pay = scorePay(s);
  const need = scoreNeed(s);
  const fit = scoreFit(s);

  // STUFE 3: Pain-Signale
  const pain_signals = computePainSignals(s);
  const pain = painScore(pain_signals);
  const highPain = hasHighWeightPain(pain_signals);

  // STUFE 4: Verrechnung + Oberindikator
  const final = verrechnen(pay.score, need.score, pain);
  const einstufung = einstufen(pay.score, fit.score, final, highPain);
  const offProfil = fit.score < C.FIT_GATE;

  const empfehlung: Empfehlung =
    einstufung === "IN_NEED" || einstufung === "INTERESTED" ? "kontaktieren" : "spaeter";

  const gefunden = pain_signals.filter((x) => x.found).map((x) => x.label);
  const begruendung_kurz =
    `${einstufung.replace("_", " ")}: final ${final}/100 ` +
    `(pay ${pay.score}, need ${need.score}, fit ${fit.score}, pain ${pain}). ` +
    (gefunden.length ? `Belegte Pain-Signale: ${gefunden.join(", ")}. ` : "Keine belegten Pain-Signale. ") +
    (offProfil ? "Off-Profil (fit unter Gate) -> max COMMON. " : "") +
    "Anlass/Erreichbarkeit/Langfristigkeit unbekannt -> Erstkontakt.";

  return {
    ...base,
    tier_c_on_hold: offProfil,
    einstufung,
    pay_score: pay.score,
    need_score: need.score,
    fit_score: fit.score,
    pain_match_score: pain,
    final_score: final,
    pay, need, fit,
    pain_signals,
    empfehlung,
    begruendung_kurz,
  };
}
