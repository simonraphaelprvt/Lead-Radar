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

function parseProfile(p: IgProfile, handle: string): IgIntel {
  const exists = !!p.username && !p.error;
  const priv = !!p.private;
  const posts = Array.isArray(p.latestPosts) ? p.latestPosts : [];

  const stamp = (x: IgPost) => {
    const t = x.timestamp ? Date.parse(x.timestamp) : NaN;
    return Number.isFinite(t) ? t : null;
  };
  const postTimes = posts.map(stamp).filter((t): t is number => t != null);
  // Reel = productType "clips".
  const reelTimes = posts
    .filter((x) => (x.productType ?? "").toLowerCase() === "clips")
    .map(stamp)
    .filter((t): t is number => t != null);

  const lastReelDays = reelTimes.length ? daysSince(Math.max(...reelTimes)) : null;
  const reels90d = reelTimes.filter((t) => daysSince(t) <= 90).length;
  const lastPostDays = postTimes.length ? daysSince(Math.max(...postTimes)) : null;

  return {
    handle,
    exists,
    private: priv,
    followers: typeof p.followersCount === "number" ? p.followersCount : null,
    postsCount: typeof p.postsCount === "number" ? p.postsCount : null,
    hasReels: reelTimes.length > 0,
    lastReelDays,
    reels90d,
    lastPostDays,
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
