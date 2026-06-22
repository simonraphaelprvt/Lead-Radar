"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Lead, Einstufung, PipelineStatus } from "@/lib/types";
import { qualify, type BusinessSignals } from "@/lib/reasoning";
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
    // v5: Engine v3 + Website/IG-Enrichment -> aeltere Caches ohne Enrichment-Felder.
    const key = `v5|${origin.lat.toFixed(4)},${origin.lng.toFixed(4)},${radiusKm},${cats.join("+")}`;

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
