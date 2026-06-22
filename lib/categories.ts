// ====================================================================
// Branchen-Katalog
// --------------------------------------------------------------------
// Jede Kategorie mappt auf einen oder mehrere OpenStreetMap-Tags
// ("key=value") und traegt die Startwerte fuer Zahlungskraft (pay) und
// Branchen-Fit. Diese Werte sind bewusst Konstanten und leicht anpassbar.
//
// pay-Tier (Zahlungskraft):
//   hoch  : payMin 75-80 .. payMax 100
//   mittel: payMin 45    .. payMax ~72
//   niedrig: payMin 5    .. payMax ~42  (Imbiss/Doener/Kiosk -> Bremse)
//
// fit (Branchen-Fit, Eignung als Social-Media-Retainer-Kunde):
//   Kernbranchen (Gastro, Automotive, Nightlife, Fitness, Hospitality,
//   Beauty, Immobilien) = hoch; angrenzend = mittel; unpassend = niedrig.
// ====================================================================

export type BranchGroup = "core" | "adjacent" | "low" | "b2b";

export interface BusinessCategory {
  id: string;
  label: string; // deutsche UI-Bezeichnung
  osm: string[]; // OpenStreetMap-Selektoren "key=value" fuer Overpass
  /** Mittelwert der Zahlungskraft-Spanne (Startwert). */
  payBase: number;
  /** Untergrenze der Tier-Spanne (pay wird >= payMin geklemmt). */
  payMin: number;
  /** Obergrenze der Tier-Spanne (pay wird <= payMax geklemmt). */
  payMax: number;
  /** Branchen-Fit 0..100. */
  fit: number;
  group: BranchGroup;
}

export const CATEGORIES: BusinessCategory[] = [
  // ---------- Hohe Zahlungskraft, hoher Fit (Top-Ziele) ----------
  { id: "autohaus", label: "Autohaus", osm: ["shop=car"], payBase: 90, payMin: 80, payMax: 100, fit: 95, group: "core" },
  { id: "nightclub", label: "Nachtclub / Diskothek", osm: ["amenity=nightclub"], payBase: 88, payMin: 78, payMax: 100, fit: 96, group: "core" },
  { id: "hotel", label: "Hotel", osm: ["tourism=hotel"], payBase: 86, payMin: 75, payMax: 100, fit: 90, group: "core" },
  { id: "immobilien", label: "Immobilienmakler", osm: ["office=estate_agent"], payBase: 85, payMin: 75, payMax: 100, fit: 82, group: "core" },
  { id: "beauty", label: "Kosmetik / Beauty", osm: ["shop=beauty", "leisure=spa"], payBase: 74, payMin: 58, payMax: 95, fit: 90, group: "core" },
  { id: "zahnarzt", label: "Zahnarzt", osm: ["amenity=dentist", "healthcare=dentist"], payBase: 88, payMin: 78, payMax: 100, fit: 72, group: "adjacent" },

  // ---------- Mittlere Zahlungskraft, hoher Fit (Kerngeschaeft) ----------
  { id: "restaurant", label: "Restaurant", osm: ["amenity=restaurant"], payBase: 58, payMin: 45, payMax: 78, fit: 92, group: "core" },
  { id: "cafe", label: "Café", osm: ["amenity=cafe"], payBase: 55, payMin: 45, payMax: 72, fit: 88, group: "core" },
  { id: "bar", label: "Bar", osm: ["amenity=bar", "amenity=pub"], payBase: 60, payMin: 48, payMax: 80, fit: 90, group: "core" },
  { id: "fitness", label: "Fitnessstudio", osm: ["leisure=fitness_centre"], payBase: 60, payMin: 50, payMax: 82, fit: 90, group: "core" },
  { id: "friseur", label: "Friseur", osm: ["shop=hairdresser"], payBase: 58, payMin: 45, payMax: 74, fit: 85, group: "core" },
  { id: "eventlocation", label: "Eventlocation", osm: ["amenity=events_venue", "amenity=conference_centre"], payBase: 68, payMin: 55, payMax: 88, fit: 80, group: "adjacent" },
  { id: "boutique", label: "Boutique / Mode", osm: ["shop=clothes"], payBase: 58, payMin: 45, payMax: 74, fit: 76, group: "adjacent" },
  { id: "autowerkstatt", label: "Autowerkstatt", osm: ["shop=car_repair"], payBase: 66, payMin: 55, payMax: 84, fit: 70, group: "adjacent" },

  // ---------- Hohe Zahlungskraft, niedriger Fit (Fit-Gate bremst) ----------
  { id: "bau", label: "Bauunternehmen", osm: ["craft=builder", "office=construction_company"], payBase: 82, payMin: 72, payMax: 100, fit: 64, group: "adjacent" },
  { id: "arztpraxis", label: "Arztpraxis", osm: ["amenity=doctors", "healthcare=doctor"], payBase: 85, payMin: 76, payMax: 100, fit: 52, group: "adjacent" },
  { id: "anwalt", label: "Anwaltskanzlei", osm: ["office=lawyer"], payBase: 88, payMin: 78, payMax: 100, fit: 42, group: "adjacent" },
  { id: "steuerberater", label: "Steuerberater", osm: ["office=tax_advisor", "office=accountant"], payBase: 85, payMin: 76, payMax: 100, fit: 40, group: "adjacent" },

  // ---------- Niedrige Zahlungskraft (immer COLD, "Bremse") ----------
  { id: "imbiss", label: "Imbiss / Döner", osm: ["amenity=fast_food"], payBase: 22, payMin: 5, payMax: 35, fit: 80, group: "low" },
  { id: "baeckerei", label: "Bäckerei", osm: ["shop=bakery"], payBase: 25, payMin: 10, payMax: 38, fit: 68, group: "low" },
  { id: "kiosk", label: "Kiosk / Späti", osm: ["shop=kiosk", "shop=convenience"], payBase: 18, payMin: 5, payMax: 32, fit: 45, group: "low" },
  { id: "einzelhandel", label: "Einzelhandel (klein)", osm: ["shop=variety_store", "shop=department_store"], payBase: 28, payMin: 15, payMax: 42, fit: 55, group: "low" },

  // ---------- B2B / Hohe Zahlungskraft ----------
  // Hinweis: B2B-Betriebe sind in OpenStreetMap oft duenn als Punkte erfasst,
  // daher liefern diese Kategorien meist weniger Treffer als Gastro/Handel.
  { id: "maschinenbau", label: "Maschinenbau / Industrie", osm: ["man_made=works", "office=company"], payBase: 88, payMin: 78, payMax: 100, fit: 62, group: "b2b" },
  { id: "software", label: "Software / SaaS", osm: ["office=it", "office=telecommunication"], payBase: 90, payMin: 78, payMax: 100, fit: 74, group: "b2b" },
  { id: "recruiting", label: "Personalvermittlung / Recruiting", osm: ["office=employment_agency"], payBase: 85, payMin: 75, payMax: 100, fit: 72, group: "b2b" },
  { id: "versicherung", label: "Versicherung / Finanzberatung", osm: ["office=insurance", "office=financial", "office=financial_advisor"], payBase: 86, payMin: 76, payMax: 100, fit: 64, group: "b2b" },
  { id: "bautraeger", label: "Bauträger / Immobilienentwickler", osm: ["office=property_management"], payBase: 88, payMin: 78, payMax: 100, fit: 66, group: "b2b" },
  { id: "medizintechnik", label: "Medizintechnik / Health-Tech", osm: ["shop=medical_supply", "healthcare=laboratory"], payBase: 88, payMin: 78, payMax: 100, fit: 64, group: "b2b" },
  { id: "ingenieur", label: "Ingenieurbüro", osm: ["office=engineer", "office=architect"], payBase: 84, payMin: 76, payMax: 100, fit: 62, group: "b2b" },
  { id: "ecommerce", label: "E-Commerce-Marke (eigenes Lager)", osm: ["office=company", "shop=trade"], payBase: 82, payMin: 70, payMax: 100, fit: 78, group: "b2b" },
];

const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Fallback-Kategorie, falls eine unbekannte id reinkommt (Scoring wirft nie). */
export const DEFAULT_CATEGORY: BusinessCategory = {
  id: "unknown",
  label: "Sonstiges",
  osm: [],
  payBase: 40,
  payMin: 20,
  payMax: 60,
  fit: 45,
  group: "low",
};

export function getCategory(id: string): BusinessCategory {
  return CATEGORY_MAP.get(id) ?? DEFAULT_CATEGORY;
}

/** Liste fuer das UI-Multi-Select. */
export function categoriesForUI(): BusinessCategory[] {
  return CATEGORIES;
}

/** Union aller OSM-Selektoren fuer eine Menge von Kategorie-ids (dedupliziert). */
export function osmSelectors(ids: string[]): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    for (const sel of getCategory(id).osm) set.add(sel);
  }
  return [...set];
}

/**
 * Bestimmt aus den OSM-Tags eines Treffers die passende Kategorie unter den
 * ausgewaehlten Kandidaten. Bei mehreren Treffern gewinnt die hoehere
 * Zahlungskraft, damit z.B. ein "shop=car" als Autohaus und nicht als
 * generischer Laden eingestuft wird.
 */
export function categoryForTags(
  tags: Record<string, string>,
  candidateIds: string[],
): string | null {
  const cands = candidateIds
    .map(getCategory)
    .sort((a, b) => b.payBase - a.payBase);
  for (const c of cands) {
    for (const sel of c.osm) {
      const [k, v] = sel.split("=");
      if (tags[k] === v) return c.id;
    }
  }
  return null;
}
