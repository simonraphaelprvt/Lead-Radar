// ====================================================================
// Website-/Instagram-Enrichment (server-only)
// --------------------------------------------------------------------
// Holt pro Lead die Website (best-effort, kurzer Timeout) und leitet
// REALE Datenpunkte ab, die der Google-Places-Scan nicht liefert:
//   - HTTPS / Responsive-Viewport / erkannter Baukasten (Website-Technik)
//   - auf der Seite verlinktes Instagram-Handle (IG-Praesenz)
//   - best-effort IG-Aktivitaet (letzter Post) - haeufig blockiert -> null
// Speist die Pain-Signale in reasoning.ts. Ehrlichkeitsregel: was nicht
// ermittelbar ist, bleibt null (-> Signal "nicht pruefbar" -> Erstkontakt).
// ====================================================================

const UA =
  "Mozilla/5.0 (compatible; LeadRadarBot/1.0; +https://lead-radar-mu.vercel.app)";

export interface SiteIntel {
  siteReachable: boolean | null;
  siteHttps: boolean | null;
  siteResponsive: boolean | null;
  siteBuilder: string | null;
  instagramHandle: string | null;
  igChecked: boolean;
  igLastPostDaysAgo: number | null;
}

const EMPTY: SiteIntel = {
  siteReachable: null,
  siteHttps: null,
  siteResponsive: null,
  siteBuilder: null,
  instagramHandle: null,
  igChecked: false,
  igLastPostDaysAgo: null,
};

function normalizeUrl(u: string): string {
  return u.startsWith("http") ? u : `https://${u}`;
}

// Erkennbare Website-Baukaesten (Indiz fuer generische/veraltete Praesenz).
const BUILDERS: { key: string; needles: string[] }[] = [
  { key: "Wix", needles: ["wix.com", "wixstatic.com", "_wix"] },
  { key: "Jimdo", needles: ["jimdo", "jimdofree"] },
  { key: "Squarespace", needles: ["squarespace.com", "static1.squarespace"] },
  { key: "Weebly", needles: ["weebly.com", "weeblycloud"] },
  { key: "GoDaddy", needles: ["godaddy", "websitebuilder", "secureserver.net"] },
  { key: "IONOS", needles: ["ionos", "1and1", "mysites.io"] },
  { key: "Shopify", needles: ["cdn.shopify.com", "myshopify.com"] },
];

function detectBuilder(html: string): string | null {
  const h = html.toLowerCase();
  for (const b of BUILDERS) if (b.needles.some((n) => h.includes(n))) return b.key;
  return null;
}

// Instagram-Handle aus Links auf der Seite. Schliesst Nicht-Profile aus.
const IG_RE =
  /instagram\.com\/(?!p\/|reel\/|explore\/|accounts\/|stories\/|tv\/|share\/)([a-zA-Z0-9._]{2,30})/;
function extractInstagram(html: string): string | null {
  const m = html.match(IG_RE);
  if (!m) return null;
  return m[1].replace(/\/$/, "").toLowerCase();
}

async function fetchText(
  url: string,
  ms: number,
): Promise<{ ok: boolean; status: number; html: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(ms),
    });
    const buf = await res.arrayBuffer();
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 250_000));
    return { ok: res.ok, status: res.status, html };
  } catch {
    return null;
  }
}

/** Best-effort: letzter IG-Post in Tagen aus eingebettetem JSON. Meist null. */
function parseIgLastPostDays(html: string): number | null {
  const m = html.match(/"taken_at_timestamp":(\d{10})/) || html.match(/"taken_at":(\d{10})/);
  if (!m) return null;
  const ts = parseInt(m[1], 10) * 1000;
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  return days >= 0 && days < 4000 ? days : null;
}

/** Eine Website anreichern. igProbe = zusaetzlicher (fragiler) IG-Profil-Fetch. */
export async function enrichSite(
  websiteUri: string | null | undefined,
  opts?: { igProbe?: boolean },
): Promise<SiteIntel> {
  if (!websiteUri) return { ...EMPTY };
  const url = normalizeUrl(websiteUri);
  const https = url.startsWith("https");

  const r = await fetchText(url, 4500);
  if (!r || !r.ok) {
    return { ...EMPTY, siteReachable: false, siteHttps: https };
  }

  const handle = extractInstagram(r.html);
  const intel: SiteIntel = {
    siteReachable: true,
    siteHttps: https,
    siteResponsive: /<meta[^>]+name=["']?viewport/i.test(r.html),
    siteBuilder: detectBuilder(r.html),
    instagramHandle: handle,
    igChecked: true,
    igLastPostDaysAgo: null,
  };

  // Best-effort IG-Pruefung nur wenn ein Handle gefunden wurde.
  if (handle && opts?.igProbe) {
    const ig = await fetchText(`https://www.instagram.com/${handle}/`, 3500);
    if (ig && ig.status === 404) intel.instagramHandle = null; // toter Link
    else if (ig && ig.ok) intel.igLastPostDaysAgo = parseIgLastPostDays(ig.html);
  }

  return intel;
}
