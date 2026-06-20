// ====================================================================
// Instagram-Anreicherung
// --------------------------------------------------------------------
// Holt serverseitig die Firmen-Website und parst das HTML nach Links auf
// instagram.com. Extrahiert den Handle. KEIN Scraping darueber hinaus:
// keine Follower, keine Posts. Wird nichts gefunden -> null (ehrlich,
// nie raten).
// ====================================================================

// Pfade, die KEIN Profil sind und ignoriert werden muessen.
const NON_PROFILE = new Set([
  "p",
  "reel",
  "reels",
  "explore",
  "stories",
  "tv",
  "accounts",
  "about",
  "developer",
  "directory",
  "legal",
  "privacy",
  "share",
]);

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

/**
 * Sucht in einem HTML-String den ersten plausiblen Instagram-Profil-Link.
 * Liefert die kanonische Profil-URL oder null.
 */
export function extractInstagram(html: string): string | null {
  // Alle instagram.com-Vorkommen einsammeln (href, og:url, plain text).
  const matches = html.matchAll(
    /(?:https?:)?\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._/?=&%-]+)/gi,
  );

  for (const m of matches) {
    const raw = m[1] ?? "";
    // Querystring und Trailing-Slash entfernen, ersten Pfadteil nehmen.
    const firstSeg = raw.split(/[/?#]/)[0]?.trim().toLowerCase();
    if (!firstSeg) continue;
    if (NON_PROFILE.has(firstSeg)) continue;
    if (!HANDLE_RE.test(firstSeg)) continue;
    return `https://instagram.com/${firstSeg}`;
  }
  return null;
}

/**
 * Holt eine Website und extrahiert den Instagram-Handle.
 * Robust: Timeout, Fehler werden gefangen und als null zurueckgegeben.
 */
export async function enrichInstagram(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LeadRadar/1.0; +https://vercel.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    // Nur die ersten ~600 KB lesen, reicht fuer Header/Footer-Links.
    const html = (await res.text()).slice(0, 600_000);
    return extractInstagram(html);
  } catch {
    return null;
  }
}
