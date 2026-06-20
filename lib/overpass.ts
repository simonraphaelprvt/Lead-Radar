// ====================================================================
// OpenStreetMap / Overpass API - serverseitiger Client
// --------------------------------------------------------------------
// Komplett kostenlos: kein API-Key, kein Billing, keine Karte noetig.
// Eine Union-Abfrage holt alle gewaehlten Branchen in einem Request.
// Hinweis: OSM liefert keine Sterne-Bewertung, keine Bewertungsanzahl
// und kein Preisniveau. Dafuer oft Website, Telefon, Oeffnungszeiten und
// gelegentlich contact:instagram direkt.
// ====================================================================

// Endpunkte in Prioritaet. overpass-api.de ist der kanonische, zuverlaessige
// Server und bekommt mehr Versuche; kumi.systems ist Fallback. Bewusst KEIN
// osm.ch-Mirror, der liefert fuer diese Query stillschweigend leere Ergebnisse
// und wuerde ein Scheitern als "0 Treffer" maskieren.
const ENDPOINTS = [
  { url: "https://overpass-api.de/api/interpreter", attempts: 3 },
  { url: "https://overpass.kumi.systems/api/interpreter", attempts: 2 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface Center {
  lat: number;
  lng: number;
}

/** Baut die Overpass-QL-Abfrage aus "key=value"-Selektoren. */
function buildQuery(selectors: string[], center: Center, radiusMeters: number): string {
  const around = `(around:${radiusMeters},${center.lat},${center.lng})`;
  const body = selectors
    .map((sel) => {
      const [k, v] = sel.split("=");
      return `  nwr["${k}"="${v}"]${around};`;
    })
    .join("\n");
  return `[out:json][timeout:25];\n(\n${body}\n);\nout center 200;`;
}

/** Fuehrt die Abfrage aus, mit Endpoint-Fallback. */
export async function overpassQuery(
  selectors: string[],
  center: Center,
  radiusMeters: number,
): Promise<OverpassElement[]> {
  if (selectors.length === 0) return [];
  const query = buildQuery(selectors, center, radiusMeters);
  let lastError = "";

  for (const { url, attempts } of ENDPOINTS) {
    // 429/503/504 (Drosselung/ausgelastet) bekommen einen wachsenden Backoff
    // und werden am selben Endpunkt erneut versucht, bevor der naechste folgt.
    for (let attempt = 0; attempt < attempts; attempt++) {
      const last = attempt === attempts - 1;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.status === 429 || res.status === 503 || res.status === 504) {
          lastError = `${res.status} ${url}`;
          if (!last) {
            await sleep(1000 * (attempt + 1));
            continue; // selben Endpunkt nochmal versuchen
          }
          break; // naechster Mirror
        }
        if (!res.ok) {
          lastError = `${res.status} ${url}`;
          break; // naechster Mirror
        }
        const data = (await res.json()) as {
          elements?: OverpassElement[];
          remark?: string;
        };
        // Overpass meldet Ueberlast/Timeout als HTTP 200 mit leeren elements
        // plus remark. Das als weichen Fehler behandeln (Retry, dann Mirror).
        if (data.remark && (data.elements?.length ?? 0) === 0) {
          lastError = `remark "${data.remark.slice(0, 80)}" @ ${url}`;
          if (!last) {
            await sleep(1000 * (attempt + 1));
            continue;
          }
          break;
        }
        return data.elements ?? [];
      } catch (e) {
        lastError = (e as Error).message;
        break; // Netzwerkfehler -> naechster Mirror
      }
    }
  }
  throw new Error(`Overpass gerade nicht erreichbar (${lastError}). Kurz warten und erneut scannen.`);
}

// ---- Tag-Extraktoren ----
type Tags = Record<string, string>;

export function osmLatLng(el: OverpassElement): { lat: number; lng: number } | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

export function osmName(t: Tags): string {
  return t.name ?? t["brand"] ?? t["operator"] ?? "(ohne Namen)";
}

export function osmAddress(t: Tags): string {
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
  const city = [t["addr:postcode"], t["addr:city"]].filter(Boolean).join(" ");
  return [street, city].filter(Boolean).join(", ");
}

export function osmWebsite(t: Tags): string | undefined {
  return t.website ?? t["contact:website"] ?? t.url ?? undefined;
}

export function osmPhone(t: Tags): string | undefined {
  return t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ?? undefined;
}

export function osmHours(t: Tags): string[] | undefined {
  const oh = t.opening_hours;
  if (!oh) return undefined;
  return oh
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Liefert eine reine Google-Maps-Such-URL (kein API-Call, nur ein Link). */
export function osmMapsUri(name: string, lat: number, lng: number): string {
  const q = encodeURIComponent(`${name} ${lat},${lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Normalisiert contact:instagram (Handle oder URL) zu einer Profil-URL. */
export function osmInstagram(t: Tags): string | undefined {
  const v = (t["contact:instagram"] ?? t.instagram ?? "").trim();
  if (!v) return undefined;
  if (v.includes("instagram.com")) {
    const m = v.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    return m ? `https://instagram.com/${m[1].toLowerCase()}` : undefined;
  }
  const handle = v.replace(/^@/, "").trim();
  return /^[A-Za-z0-9._]{1,30}$/.test(handle)
    ? `https://instagram.com/${handle.toLowerCase()}`
    : undefined;
}
