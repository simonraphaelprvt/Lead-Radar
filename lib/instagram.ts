// ====================================================================
// Instagram-Enrichment via Apify (server-only)
// --------------------------------------------------------------------
// Holt fuer eine Liste Handles in EINEM Apify-Actor-Run die Profile und
// leitet REALE Aktivitaets-Signale ab - vor allem Reels (productType
// "clips"): existiert der Account, hat er Reels, wann war das letzte,
// wie regelmaessig. Diese Signale fliessen in die Bewertung (need + Pain).
//
// Ehrlichkeitsregel: privat/nicht ermittelbar -> Felder null/false +
// igProbed-Flag, NIE geraten. Free-Plan: ein Run pro Scan, gedeckelt.
// ====================================================================

const TOKEN = process.env.APIFY_API_TOKEN ?? "";
const ACTOR = "apify~instagram-profile-scraper";

export function apifyConfigured(): boolean {
  return TOKEN.length > 0;
}

/** Abgeleitete IG-Aktivitaet pro Handle (nur reale Werte). */
export interface IgIntel {
  handle: string;
  exists: boolean;
  private: boolean;
  followers: number | null;
  postsCount: number | null;
  /** Reel in den letzten ~12 Posts vorhanden? */
  hasReels: boolean;
  /** Tage seit dem neuesten Reel (clips); null = keine Reels/ermittelbar. */
  lastReelDays: number | null;
  /** Anzahl Reels in den letzten 90 Tagen (Takt-Proxy). */
  reels90d: number;
  /** Tage seit letztem Post jeglicher Art (Fallback). */
  lastPostDays: number | null;
}

interface IgPost {
  type?: string;
  productType?: string | null;
  timestamp?: string;
  ownerUsername?: string;
}
interface IgProfile {
  username?: string;
  private?: boolean;
  followersCount?: number;
  postsCount?: number;
  latestPosts?: IgPost[];
  error?: string;
  errorDescription?: string;
}

const DAY = 86_400_000;
function daysSince(ms: number): number {
  return Math.floor((Date.now() - ms) / DAY);
}

// --- Namens-Abgleich (gegen Fehltreffer der Suche) ------------------
function deaccent(s: string): string {
  return s.toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss");
}
// Generische Branchen-/Rechtsform-Woerter aus Name UND Handle entfernen, damit
// nur der ECHTE Firmenname uebrig bleibt (sonst matcht "immobilienbewertung"
// als Token quer). Substring-Entfernung, nicht nur ganze Token.
const GENERIC_SUB =
  /immobilienbewertung|immobilienverwaltung|hausverwaltung|immobilien|immobilie|bewertung|verwaltung|makler|maklerin|immo|estate|sachverstaendige?r?|gmbh|mbh|gruppe|group|consulting|official|deutschland/g;
function stripGeneric(s: string): string {
  return deaccent(s).replace(GENERIC_SUB, " ");
}
function distinctiveTokens(name: string): string[] {
  return stripGeneric(name).split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
}
/** Gehoert das gefundene Handle wirklich zu diesem Namen? */
function handleMatchesName(handle: string, name: string): boolean {
  const toks = distinctiveTokens(name);
  if (toks.length === 0) return false; // nichts Unterscheidbares -> nicht riskieren
  const h = stripGeneric(handle);
  return toks.some((t) => h.includes(t));
}

/** Reel-/Post-Aktivitaet aus einer Liste Posts (Reel = productType "clips"). */
function reelsFromPosts(posts: IgPost[]): Pick<IgIntel, "hasReels" | "lastReelDays" | "reels90d" | "lastPostDays"> {
  const stamp = (x: IgPost) => {
    const t = x.timestamp ? Date.parse(x.timestamp) : NaN;
    return Number.isFinite(t) ? t : null;
  };
  const postTimes = posts.map(stamp).filter((t): t is number => t != null);
  const reelTimes = posts
    .filter((x) => (x.productType ?? "").toLowerCase() === "clips")
    .map(stamp)
    .filter((t): t is number => t != null);
  return {
    hasReels: reelTimes.length > 0,
    lastReelDays: reelTimes.length ? daysSince(Math.max(...reelTimes)) : null,
    reels90d: reelTimes.filter((t) => daysSince(t) <= 90).length,
    lastPostDays: postTimes.length ? daysSince(Math.max(...postTimes)) : null,
  };
}

function parseProfile(p: IgProfile, handle: string): IgIntel {
  const exists = !!p.username && !p.error;
  const posts = Array.isArray(p.latestPosts) ? p.latestPosts : [];
  return {
    handle,
    exists,
    private: !!p.private,
    followers: typeof p.followersCount === "number" ? p.followersCount : null,
    postsCount: typeof p.postsCount === "number" ? p.postsCount : null,
    ...reelsFromPosts(posts),
  };
}

/** "nicht ermittelt" - wenn der Handle nicht im Apify-Ergebnis auftaucht. */
function unknownIntel(handle: string): IgIntel {
  return {
    handle,
    exists: false,
    private: false,
    followers: null,
    postsCount: null,
    hasReels: false,
    lastReelDays: null,
    reels90d: 0,
    lastPostDays: null,
  };
}

/**
 * Mehrere Handles in EINEM Apify-Run. timeoutMs deckelt die Wartezeit
 * (Apify-Run laeuft serverseitig ggf. weiter; wir geben einfach auf).
 * Liefert handle(lowercase) -> IgIntel. Bei Fehler/leer: leere Map.
 */
export async function fetchIgProfiles(
  handles: string[],
  timeoutMs = 55_000,
): Promise<Record<string, IgIntel>> {
  const clean = Array.from(new Set(handles.map((h) => h.replace(/^@/, "").toLowerCase()).filter(Boolean)));
  if (!TOKEN || clean.length === 0) return {};

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: clean }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) return {};
    const items = (await res.json()) as IgProfile[];
    const out: Record<string, IgIntel> = {};
    for (const item of Array.isArray(items) ? items : []) {
      const u = (item.username ?? "").toLowerCase();
      if (u) out[u] = parseProfile(item, u);
    }
    // Handles ohne Treffer -> als "nicht existent/ermittelt" markieren.
    for (const h of clean) if (!(h in out)) out[h] = unknownIntel(h);
    return out;
  } catch {
    return {};
  }
}

/**
 * Instagram-NAMENS-Suche (fuer Leads ohne Website-Handle): findet den
 * passendsten Account und leitet aus dessen letzten Posts die Reels-
 * Aktivitaet ab. Ein Apify-Run pro Suche (langsam ~30-50s).
 * Liefert IgIntel des Treffers oder null (kein Account gefunden).
 */
export async function searchIgProfile(
  query: string,
  nameForMatch: string,
  timeoutMs = 55_000,
): Promise<IgIntel | null> {
  const q = query.trim();
  if (!TOKEN || !q) return null;
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search: q,
          searchType: "user",
          searchLimit: 1,
          resultsType: "posts",
          resultsLimit: 6,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) return null;
    const items = (await res.json()) as IgPost[];
    if (!Array.isArray(items) || items.length === 0) return null;

    // Dominanter ownerUsername = der getroffene Account.
    const byOwner = new Map<string, IgPost[]>();
    for (const it of items) {
      const ou = (it.ownerUsername ?? "").toLowerCase();
      if (!ou) continue;
      const arr = byOwner.get(ou) ?? [];
      arr.push(it);
      byOwner.set(ou, arr);
    }
    if (byOwner.size === 0) return null;
    let best = "";
    let bestN = -1;
    for (const [owner, arr] of byOwner) if (arr.length > bestN) { best = owner; bestN = arr.length; }

    // Fehltreffer-Schutz: Handle muss zum Firmennamen passen.
    if (!handleMatchesName(best, nameForMatch)) return null;

    return { handle: best, exists: true, private: false, followers: null, postsCount: null, ...reelsFromPosts(byOwner.get(best) ?? []) };
  } catch {
    return null;
  }
}
