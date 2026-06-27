"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Lead, Einstufung, PipelineStatus } from "@/lib/types";
import { qualify, type BusinessSignals } from "@/lib/reasoning";
import type { IgIntel } from "@/lib/instagram";
import { APP_CONFIG, STORAGE_KEYS } from "@/lib/constants";
import { leadsToCsv, downloadFile } from "@/lib/exporters";

import Hud from "@/components/Hud";
import SearchPanel from "@/components/SearchPanel";
import LeadList from "@/components/LeadList";
import LeadDrawer from "@/components/LeadDrawer";
import PipelineBoard from "@/components/PipelineBoard";
import type { AppView } from "@/components/ViewSwitcher";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full grid place-items-center text-phosphor-muted text-xs">
      Karte wird geladen …
    </div>
  ),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignorieren */
  }
}

type ScanCache = Record<string, { ts: number; leads: Lead[] }>;

/** Pro Lead gecachte Google-Kontaktdaten + Standort-Foto (beim Oeffnen geholt). */
type GoogleEntry = {
  phone: string | null;
  address: string | null;
  openingHours: string[] | null;
  googleMapsUri: string | null;
  photoUrl: string | null;
};
type GoogleCache = Record<string, GoogleEntry>;

/** Google-Kontaktdaten in einen Lead fuellen (nur Luecken, KEIN Einfluss auf
 *  die Engine-Bewertung - die steht beim Scan fest). */
function mergeGoogle(lead: Lead, g: GoogleEntry): Lead {
  return {
    ...lead,
    photoUrl: g.photoUrl,
    phone: lead.phone ?? g.phone ?? undefined,
    address: lead.address || g.address || "",
    openingHours:
      lead.openingHours && lead.openingHours.length > 0 ? lead.openingHours : g.openingHours ?? undefined,
    googleMapsUri: g.googleMapsUri ?? lead.googleMapsUri,
  };
}

const RANK: Record<Einstufung, number> = { IN_NEED: 0, INTERESTED: 1, COMMON: 2, RAUS: 3 };
function sortClient(list: Lead[]): Lead[] {
  return [...list].sort((a, b) => {
    const r = RANK[a.einstufung] - RANK[b.einstufung];
    if (r !== 0) return r;
    if (a.tierCOnHold !== b.tierCOnHold) return a.tierCOnHold ? 1 : -1;
    return b.finalScore - a.finalScore;
  });
}

/** Re-Qualifiziert einen Lead live im Browser (alle Signale stecken im Lead) -
 *  z.B. wenn der Ketten-Filter umgeschaltet wird. Die Engine ist rein. */
function requalify(l: Lead, filterChains: boolean): Lead {
  const s: BusinessSignals = {
    name: l.name,
    categoryLabel: l.categoryLabel,
    types: l.types,
    rating: l.rating,
    reviewCount: l.reviewCount,
    priceLevel: l.priceLevel,
    photoCount: l.photoCount,
    website: l.website ?? null,
    hasSocial: null,
    phone: l.phone ?? null,
    address: l.address,
    lat: l.lat,
    lng: l.lng,
    // Enrichment-Signale durchreichen -> Pain-Signale bleiben beim Requalify gleich.
    siteReachable: l.siteReachable ?? null,
    siteHttps: l.siteHttps ?? null,
    siteResponsive: l.siteResponsive ?? null,
    siteBuilder: l.siteBuilder ?? null,
    instagramHandle: l.instagramHandle ?? null,
    igChecked: l.igChecked ?? false,
    igLastPostDaysAgo: l.igLastPostDaysAgo ?? null,
    igProbed: l.igProbed ?? false,
    igExists: l.igExists,
    igPrivate: l.igPrivate,
    igHasReels: l.igHasReels,
    igLastReelDays: l.igLastReelDays ?? null,
    igReels90d: l.igReels90d,
    igFollowers: l.igFollowers ?? null,
  };
  const q = qualify(s, { filterChains });
  return {
    ...l,
    einstufung: q.einstufung,
    tier: q.tier,
    tierCOnHold: q.tier_c_on_hold,
    payScore: q.pay_score,
    needScore: q.need_score,
    fitScore: q.fit_score,
    painMatchScore: q.pain_match_score,
    finalScore: q.final_score,
    painSignals: q.pain_signals,
    koAusgeschlossen: q.ko_ausgeschlossen,
    koGrund: q.ko_grund,
    empfehlung: q.empfehlung,
    begruendungKurz: q.begruendung_kurz,
    achsen: { pay: q.pay, need: q.need, fit: q.fit },
    erstkontakt: q.im_erstkontakt_pruefen,
  };
}

type IgCache = Record<string, { ts: number; intel: IgIntel }>;

/** Apify-IG-Daten auf einen Lead schreiben + neu bewerten (Engine ist rein). */
function applyIg(l: Lead, intel: IgIntel, filterChains: boolean): Lead {
  const withIg: Lead = {
    ...l,
    igProbed: true,
    igExists: intel.exists,
    igPrivate: intel.private,
    igHasReels: intel.hasReels,
    igLastReelDays: intel.lastReelDays,
    igReels90d: intel.reels90d,
    igFollowers: intel.followers,
    instagramHandle: l.instagramHandle ?? (intel.exists ? intel.handle : l.instagramHandle),
    instagram: l.instagram ?? (intel.exists && intel.handle ? `https://instagram.com/${intel.handle}` : l.instagram),
  };
  return requalify(withIg, filterChains);
}

/** Sentinel: per Namens-Suche KEIN Account gefunden (negativ cachen). */
const IG_NOT_FOUND: IgIntel = {
  handle: "", exists: false, private: false, followers: null,
  postsCount: null, hasReels: false, lastReelDays: null, reels90d: 0, lastPostDays: null,
};

function normNameKey(n: string): string {
  return "q:" + n.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
/** Branchen-Suffixe fuers Handle-Raten (z.B. "muellerimmobilien"). */
function igSuffixes(l: Lead): string[] {
  const hay = l.categoryLabel.toLowerCase();
  const map: [RegExp, string[]][] = [
    [/immobil|makler|estate/, ["immobilien", "immo"]],
    [/restaurant|gastro/, ["restaurant", "food"]],
    [/hotel|resort/, ["hotel"]],
    [/caf|bar|club|disko/, ["bar", "cafe"]],
    [/beauty|kosmetik/, ["beauty", "kosmetik", "cosmetics"]],
    [/friseur|hair/, ["friseur", "hair", "hairstyle"]],
    [/fitness|studio|gym/, ["fitness", "gym"]],
    [/auto|kfz/, ["automobile", "cars"]],
    [/zahn|dentist|praxis|arzt/, ["praxis", "zahnarztpraxis"]],
    [/event|location/, ["events"]],
    [/bau|handwerk/, ["bau"]],
  ];
  const out = new Set<string>();
  for (const [re, sfx] of map) if (re.test(hay)) sfx.forEach((s) => out.add(s));
  return [...out];
}

export default function Page() {
  const [view, setView] = useState<AppView>("map");

  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(
    APP_CONFIG.DEFAULT_CENTER,
  );
  const [radiusKm, setRadiusKm] = useState(APP_CONFIG.DEFAULT_RADIUS_KM);
  const [categories, setCategories] = useState<string[]>([
    "restaurant",
    "hotel",
    "fitness",
    "beauty",
  ]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanErrors, setScanErrors] = useState<string[]>([]);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  // Ketten/Filialen ausschliessen (umschaltbar, wirkt live + beim naechsten Scan).
  const [filterChains, setFilterChains] = useState(true);

  const [pipeline, setPipeline] = useState<Lead[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineLoaded, setPipelineLoaded] = useState(false);
  const [addingToPipeline, setAddingToPipeline] = useState(false);
  const [pipelineActionError, setPipelineActionError] = useState<string | null>(null);

  const displayLeads = leads;

  // ---- Init / Persistenz UI-State ----
  useEffect(() => {
    const ui = readJson(STORAGE_KEYS.ui, null as null | {
      radiusKm: number;
      categories: string[];
      view: AppView;
      origin: { lat: number; lng: number } | null;
      filterChains: boolean;
    });
    if (ui) {
      if (typeof ui.radiusKm === "number") setRadiusKm(ui.radiusKm);
      if (Array.isArray(ui.categories)) setCategories(ui.categories);
      if (ui.view) setView(ui.view);
      if (ui.origin) setOrigin(ui.origin);
      if (typeof ui.filterChains === "boolean") setFilterChains(ui.filterChains);
    }
  }, []);
  useEffect(() => {
    writeJson(STORAGE_KEYS.ui, { radiusKm, categories, view, origin, filterChains });
  }, [radiusKm, categories, view, origin, filterChains]);

  const setLeadEverywhere = useCallback((updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setPipeline((prev) =>
      prev.map((l) => (l.notionPageId && l.notionPageId === updated.notionPageId ? updated : l)),
    );
    setSelected((prev) =>
      prev &&
      (prev.id === updated.id ||
        (!!prev.notionPageId && prev.notionPageId === updated.notionPageId))
        ? updated
        : prev,
    );
  }, []);

  // ---- Scan (Server: Google Bulk-Qualify + Reasoning-Engine) ----
  const handleScan = useCallback(async () => {
    if (!origin || categories.length === 0 || scanning) return;
    setScanErrors([]);
    const cats = [...categories].sort();
    // v6: + Apify-Instagram (Reels-Signale) -> aeltere Caches inkompatibel.
    const key = `v8|${origin.lat.toFixed(4)},${origin.lng.toFixed(4)},${radiusKm},${cats.join("+")}`;

    setScanning(true);
    const started = Date.now();
    const googleCache = readJson<GoogleCache>(STORAGE_KEYS.googleCache, {});
    const applyGoogle = (list: Lead[]) =>
      list.map((l) => (l.id in googleCache ? mergeGoogle(l, googleCache[l.id]) : l));

    try {
      const cache = readJson<ScanCache>(STORAGE_KEYS.scanCache, {});
      const hit = cache[key];
      if (hit && Date.now() - hit.ts < APP_CONFIG.CACHE_TTL_MS) {
        setLeads(applyGoogle(hit.leads));
        await sleep(Math.max(0, 600 - (Date.now() - started)));
      } else {
        const res = await fetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: origin.lat, lng: origin.lng, radiusKm, categories: cats, filterChains }),
        });
        const data = await res.json();
        const fresh: Lead[] = data.leads ?? [];
        setLeads(applyGoogle(fresh));
        if (fresh.length === 0 && (data.errors?.length ?? 0) === 0) {
          setScanErrors(["Keine Treffer. Radius vergroessern oder andere Branchen waehlen."]);
        } else {
          setScanErrors(data.errors ?? []);
        }
        if (fresh.length > 0) {
          const next: ScanCache = { ...cache, [key]: { ts: Date.now(), leads: fresh } };
          const keys = Object.keys(next);
          if (keys.length > 20) {
            keys.sort((a, b) => next[a].ts - next[b].ts).slice(0, keys.length - 20).forEach((k) => delete next[k]);
          }
          writeJson(STORAGE_KEYS.scanCache, next);
        }
        await sleep(Math.max(0, 1000 - (Date.now() - started)));
      }
    } catch (e) {
      setScanErrors([(e as Error).message]);
    } finally {
      setScanning(false);
    }
  }, [origin, categories, radiusKm, scanning, filterChains]);

  // Ketten-Filter umschalten -> Leads live neu qualifizieren (kein Re-Scan noetig).
  const handleToggleChains = useCallback(() => {
    setFilterChains((prev) => {
      const next = !prev;
      setLeads((ls) => sortClient(ls.map((l) => requalify(l, next))));
      setSelected((sel) => (sel ? requalify(sel, next) : sel));
      return next;
    });
  }, []);

  // ---- Google-Anreicherung beim Oeffnen eines Leads (Foto + Oeffnungszeiten) ----
  const handleEnrichGoogle = useCallback(
    async (lead: Lead) => {
      if (lead.photoUrl !== undefined) return;
      if (googleEnabled === false) {
        setLeadEverywhere({ ...lead, photoUrl: null });
        return;
      }
      try {
        const res = await fetch("/api/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: lead.name, lat: lead.lat, lng: lead.lng, address: lead.address }),
        });
        const data = await res.json();
        if (data.configured === false) {
          setGoogleEnabled(false);
          setLeadEverywhere({ ...lead, photoUrl: null });
          return;
        }
        setGoogleEnabled(true);
        const entry: GoogleEntry = {
          phone: data.phone ?? null,
          address: data.address ?? null,
          openingHours: data.openingHours ?? null,
          googleMapsUri: data.googleMapsUri ?? null,
          photoUrl: data.photoUrl ?? null,
        };
        const cache = readJson<GoogleCache>(STORAGE_KEYS.googleCache, {});
        cache[lead.id] = entry;
        writeJson(STORAGE_KEYS.googleCache, cache);
        setLeadEverywhere(mergeGoogle(lead, entry));
      } catch {
        setLeadEverywhere({ ...lead, photoUrl: null });
      }
    },
    [googleEnabled, setLeadEverywhere],
  );

  useEffect(() => {
    if (selected && selected.photoUrl === undefined) handleEnrichGoogle(selected);
  }, [selected, handleEnrichGoogle]);

  // ---- Pipeline ----
  const loadPipeline = useCallback(async () => {
    setPipelineLoading(true);
    setPipelineError(null);
    try {
      const res = await fetch("/api/notion/leads");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Notion-Fehler.");
      setPipeline(data.leads ?? []);
      setPipelineLoaded(true);
    } catch (e) {
      setPipelineError((e as Error).message);
    } finally {
      setPipelineLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "pipeline" && !pipelineLoaded) loadPipeline();
  }, [view, pipelineLoaded, loadPipeline]);

  // ---- Instagram-Enrichment (Apify, nach dem Scan) ----
  // Pass 2: verfolgenswerte Leads (Kapital+Fit) bekommen echte IG-Daten.
  //  - Handle aus der Website -> Profil-Scrape (Batch, schnell)
  //  - kein Handle -> NAMENS-SUCHE (findet den Account, gedeckelt, langsam)
  // Ergebnis 3 Wochen gecacht, in die Leads gemerged + live re-bewertet, damit
  // IG die Stufe auf Karte/Liste treibt. Engine ist rein.
  const igAttempted = useRef<Set<string>>(new Set());
  const runIgEnrichment = useCallback(
    async (cands: Lead[]) => {
      const now = Date.now();
      const cacheGet = (k: string) => {
        const c = readJson<IgCache>(STORAGE_KEYS.instaCache, {})[k];
        return c && now - c.ts < APP_CONFIG.IG_CACHE_TTL_MS ? c.intel : null;
      };
      const cachePut = (k: string, intel: IgIntel) => {
        const c = readJson<IgCache>(STORAGE_KEYS.instaCache, {});
        c[k] = { ts: now, intel };
        writeJson(STORAGE_KEYS.instaCache, c);
      };
      // Ein einzelnes Ergebnis live in die Leads mergen + re-bewerten.
      const apply = (map: Record<string, IgIntel>) =>
        setLeads((prev) =>
          sortClient(prev.map((l) => (map[l.id] && !l.igProbed ? applyIg(l, map[l.id], filterChains) : l))),
        );

      // 1) Handle-Leads: Batch-Profil-Scrape (schnell).
      const needHandles: string[] = [];
      const handleLeads: Record<string, string[]> = {};
      const cachedMerge: Record<string, IgIntel> = {};
      const resolveJobs: { key: string; nk: string; name: string; suffixes: string[] }[] = [];
      const nkByLead: Record<string, string> = {};
      for (const l of cands) {
        const h = (l.instagramHandle ?? "").toLowerCase();
        if (h) {
          (handleLeads[h] ??= []).push(l.id);
          const hit = cacheGet(h);
          if (hit) cachedMerge[l.id] = hit;
          else if (!needHandles.includes(h)) needHandles.push(h);
        } else {
          const nk = normNameKey(l.name);
          nkByLead[l.id] = nk;
          const hit = cacheGet(nk);
          if (hit) cachedMerge[l.id] = hit;
          else resolveJobs.push({ key: l.id, nk, name: l.name, suffixes: igSuffixes(l) });
        }
      }
      if (Object.keys(cachedMerge).length > 0) apply(cachedMerge);

      // 1) Handle-Leads: Batch-Profil-Scrape (schnell).
      if (needHandles.length > 0) {
        try {
          const res = await fetch("/api/instagram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ handles: needHandles }),
          });
          const data = (await res.json()) as { profiles?: Record<string, IgIntel> };
          const profiles = data.profiles ?? {};
          const merge: Record<string, IgIntel> = {};
          for (const [h, intel] of Object.entries(profiles)) {
            cachePut(h, intel);
            for (const id of handleLeads[h] ?? []) merge[id] = intel;
          }
          if (Object.keys(merge).length > 0) apply(merge);
        } catch {
          /* Leads bleiben ohne IG */
        }
      }

      // 2) Handle-lose Leads: RATEN (Name+Suffix -> Profil-Scrape, ein Batch).
      if (resolveJobs.length > 0) {
        try {
          const res = await fetch("/api/instagram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resolves: resolveJobs.map((j) => ({ key: j.key, name: j.name, suffixes: j.suffixes })),
            }),
          });
          const data = (await res.json()) as { resolveResults?: Record<string, IgIntel | null> };
          const rr = data.resolveResults ?? {};
          const merge: Record<string, IgIntel> = {};
          for (const job of resolveJobs) {
            const intel = rr[job.key] ?? null;
            const val = intel ?? IG_NOT_FOUND; // negativ cachen
            cachePut(job.nk, val);
            merge[job.key] = val;
          }
          if (Object.keys(merge).length > 0) apply(merge);
        } catch {
          /* Leads bleiben ohne IG */
        }
      }
    },
    [filterChains],
  );

  useEffect(() => {
    const cands = leads
      .filter(
        (l) =>
          l.einstufung !== "RAUS" &&
          !l.igProbed &&
          l.payScore >= APP_CONFIG.IG_CANDIDATE_PAY &&
          l.fitScore >= APP_CONFIG.IG_CANDIDATE_FIT &&
          !igAttempted.current.has(l.id),
      )
      .sort((a, b) => b.payScore - a.payScore); // teuerste zuerst
    if (cands.length === 0) return;
    // Handle-Leads sind billig (ein Batch); Namens-Suchen gedeckelt (langsam).
    // Ueber dem Deckel liegende Such-Leads bleiben fuer die naechste Runde offen.
    const withHandle = cands.filter((l) => l.instagramHandle);
    const noHandle = cands.filter((l) => !l.instagramHandle).slice(0, 12);
    const process = [...withHandle, ...noHandle];
    if (process.length === 0) return;
    for (const l of process) igAttempted.current.add(l.id);
    runIgEnrichment(process);
  }, [leads, runIgEnrichment]);

  const handleAddToPipeline = useCallback(
    async (lead: Lead) => {
      if (lead.notionPageId) return;
      setAddingToPipeline(true);
      setPipelineActionError(null);
      try {
        const res = await fetch("/api/notion/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Übertragung fehlgeschlagen.");
        const updated: Lead = {
          ...lead,
          notionPageId: data.pageId,
          status: "Neu",
          addedAt: new Date().toISOString(),
        };
        setLeadEverywhere(updated);
        setPipeline((prev) => [updated, ...prev.filter((p) => p.notionPageId !== data.pageId)]);
      } catch (e) {
        setPipelineActionError((e as Error).message);
      } finally {
        setAddingToPipeline(false);
      }
    },
    [setLeadEverywhere],
  );

  const handleChangeStatus = useCallback(
    async (pageId: string, status: PipelineStatus) => {
      setPipeline((prev) => prev.map((l) => (l.notionPageId === pageId ? { ...l, status } : l)));
      setSelected((prev) => (prev && prev.notionPageId === pageId ? { ...prev, status } : prev));
      try {
        const res = await fetch("/api/notion/leads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId, status }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Status-Update fehlgeschlagen.");
        }
      } catch (e) {
        setPipelineError((e as Error).message);
        loadPipeline();
      }
    },
    [loadPipeline],
  );

  const handleExportCsv = useCallback(() => {
    if (displayLeads.length === 0) return;
    downloadFile(
      `lead-radar-${new Date().toISOString().slice(0, 10)}.csv`,
      leadsToCsv(displayLeads),
      "text/csv;charset=utf-8",
    );
  }, [displayLeads]);

  const counts = useMemo(() => {
    const c: Record<Einstufung, number> = { IN_NEED: 0, INTERESTED: 0, COMMON: 0, RAUS: 0 };
    for (const l of displayLeads) c[l.einstufung]++;
    return c;
  }, [displayLeads]);

  const toggleCategory = (id: string) =>
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  return (
    <div className="flex h-full flex-col">
      <Hud
        view={view}
        onViewChange={setView}
        scanned={displayLeads.length}
        inNeed={counts.IN_NEED}
        interested={counts.INTERESTED}
        common={counts.COMMON}
        raus={counts.RAUS}
        pipeline={pipeline.length}
        scanning={scanning}
      />

      <div className="relative flex-1 overflow-hidden">
        <div className={view === "map" ? "h-full" : "hidden"}>
          <MapView
            leads={displayLeads}
            origin={origin}
            radiusKm={radiusKm}
            scanning={scanning}
            selectedId={selected?.id}
            onSetOrigin={setOrigin}
            onSelectLead={setSelected}
          />
          <div className="absolute left-4 top-4 z-20">
            <SearchPanel
              selected={categories}
              onToggle={toggleCategory}
              radiusKm={radiusKm}
              onRadius={setRadiusKm}
              onScan={handleScan}
              scanning={scanning}
              origin={origin}
              resultCount={displayLeads.length}
              errors={scanErrors}
              onExportCsv={handleExportCsv}
              filterChains={filterChains}
              onToggleChains={handleToggleChains}
            />
          </div>
        </div>

        {view === "list" && (
          <LeadList leads={displayLeads} onSelect={setSelected} selectedId={selected?.id} />
        )}

        {view === "pipeline" && (
          <PipelineBoard
            leads={pipeline}
            loading={pipelineLoading}
            error={pipelineError}
            onChangeStatus={handleChangeStatus}
            onRefresh={loadPipeline}
            onSelect={setSelected}
          />
        )}

        {selected && (
          <LeadDrawer
            lead={selected}
            onClose={() => setSelected(null)}
            onAddToPipeline={handleAddToPipeline}
            addingToPipeline={addingToPipeline}
            pipelineError={pipelineActionError}
            googleEnabled={googleEnabled}
          />
        )}
      </div>
    </div>
  );
}
