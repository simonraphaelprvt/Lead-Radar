"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Lead, PipelineStatus } from "@/lib/types";
import { scoreLead } from "@/lib/scoring";
import { APP_CONFIG, STORAGE_KEYS } from "@/lib/constants";
import { leadsToCsv, downloadFile } from "@/lib/exporters";

import BootSequence from "@/components/BootSequence";
import Hud from "@/components/Hud";
import SearchPanel from "@/components/SearchPanel";
import LeadList from "@/components/LeadList";
import LeadDrawer from "@/components/LeadDrawer";
import PipelineBoard from "@/components/PipelineBoard";
import type { AppView } from "@/components/ViewSwitcher";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full grid place-items-center text-phosphor-muted text-xs tracking-widest">
      ⊹ KARTE WIRD GELADEN ...
    </div>
  ),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- localStorage Helfer (clientseitig) ----
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
    /* Speicher voll / privat - ignorieren */
  }
}

type EnrichCache = Record<string, string | null>;
type ScanCache = Record<string, { ts: number; leads: Lead[] }>;

export default function Page() {
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<AppView>("map");

  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(
    APP_CONFIG.DEFAULT_CENTER,
  );
  const [radiusKm, setRadiusKm] = useState(APP_CONFIG.DEFAULT_RADIUS_KM);
  const [categories, setCategories] = useState<string[]>([
    "restaurant",
    "autohaus",
    "fitness",
    "friseur",
  ]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanErrors, setScanErrors] = useState<string[]>([]);
  const [requestCount, setRequestCount] = useState(0);

  const [enriching, setEnriching] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  const [pipeline, setPipeline] = useState<Lead[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineLoaded, setPipelineLoaded] = useState(false);
  const [addingToPipeline, setAddingToPipeline] = useState(false);
  const [pipelineActionError, setPipelineActionError] = useState<string | null>(null);

  // ---- Init aus localStorage ----
  useEffect(() => {
    const ui = readJson(STORAGE_KEYS.ui, null as null | {
      radiusKm: number;
      categories: string[];
      view: AppView;
      origin: { lat: number; lng: number } | null;
    });
    if (ui) {
      if (typeof ui.radiusKm === "number") setRadiusKm(ui.radiusKm);
      if (Array.isArray(ui.categories)) setCategories(ui.categories);
      if (ui.view) setView(ui.view);
      if (ui.origin) setOrigin(ui.origin);
    }
    setRequestCount(readJson(STORAGE_KEYS.requestCount, 0));
  }, []);

  // ---- UI-State persistieren ----
  useEffect(() => {
    writeJson(STORAGE_KEYS.ui, { radiusKm, categories, view, origin });
  }, [radiusKm, categories, view, origin]);
  useEffect(() => {
    writeJson(STORAGE_KEYS.requestCount, requestCount);
  }, [requestCount]);

  // ---- Scoring-Helfer ----
  const rescore = useCallback((lead: Lead): Lead => {
    return {
      ...lead,
      score: scoreLead({
        categoryId: lead.categoryId,
        priceLevel: lead.priceLevel,
        reviewCount: lead.reviewCount,
        rating: lead.rating,
        website: lead.website ?? null,
        instagram: lead.instagram,
        indeedFlag: lead.indeedFlag,
      }),
    };
  }, []);

  const setLeadEverywhere = useCallback((updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setPipeline((prev) =>
      prev.map((l) =>
        l.notionPageId && l.notionPageId === updated.notionPageId ? updated : l,
      ),
    );
    setSelected((prev) =>
      prev &&
      (prev.id === updated.id ||
        (!!prev.notionPageId && prev.notionPageId === updated.notionPageId))
        ? updated
        : prev,
    );
  }, []);

  // ---- Scan ----
  const handleScan = useCallback(async () => {
    if (!origin || categories.length === 0 || scanning) return;
    setScanErrors([]);
    const cats = [...categories].sort();
    const key = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)},${radiusKm},${cats.join("+")}`;

    setScanning(true);
    const started = Date.now();
    const enrichCache = readJson<EnrichCache>(STORAGE_KEYS.enrichCache, {});
    const applyEnrich = (list: Lead[]) =>
      list.map((l) =>
        l.id in enrichCache ? rescore({ ...l, instagram: enrichCache[l.id] }) : l,
      );

    try {
      const cache = readJson<ScanCache>(STORAGE_KEYS.scanCache, {});
      const hit = cache[key];
      if (hit && Date.now() - hit.ts < APP_CONFIG.CACHE_TTL_MS) {
        // Cache-Treffer: kein API-Call.
        setLeads(applyEnrich(hit.leads));
        await sleep(Math.max(0, 900 - (Date.now() - started)));
      } else {
        const res = await fetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: origin.lat, lng: origin.lng, radiusKm, categories: cats }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Scan fehlgeschlagen.");
        const fresh: Lead[] = data.leads ?? [];
        setLeads(applyEnrich(fresh));
        setScanErrors(data.errors ?? []);
        setRequestCount((c) => c + (data.requestCount ?? 0));
        // Cache schreiben (max 20 Eintraege halten)
        const next: ScanCache = { ...cache, [key]: { ts: Date.now(), leads: fresh } };
        const keys = Object.keys(next);
        if (keys.length > 20) {
          keys
            .sort((a, b) => next[a].ts - next[b].ts)
            .slice(0, keys.length - 20)
            .forEach((k) => delete next[k]);
        }
        writeJson(STORAGE_KEYS.scanCache, next);
        await sleep(Math.max(0, 1400 - (Date.now() - started)));
      }
    } catch (e) {
      setScanErrors([(e as Error).message]);
    } finally {
      setScanning(false);
    }
  }, [origin, categories, radiusKm, scanning, rescore]);

  // ---- Anreicherung (einzeln) ----
  const handleEnrichOne = useCallback(
    async (lead: Lead) => {
      if (!lead.website) return;
      setEnrichingId(lead.id);
      try {
        const res = await fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [{ id: lead.id, website: lead.website }] }),
        });
        const data = await res.json();
        const ig: string | null = data.results?.[0]?.instagram ?? null;
        const cache = readJson<EnrichCache>(STORAGE_KEYS.enrichCache, {});
        cache[lead.id] = ig;
        writeJson(STORAGE_KEYS.enrichCache, cache);
        setLeadEverywhere(rescore({ ...lead, instagram: ig }));
      } catch {
        setLeadEverywhere(rescore({ ...lead, instagram: null }));
      } finally {
        setEnrichingId(null);
      }
    },
    [rescore, setLeadEverywhere],
  );

  // ---- Anreicherung (Batch) ----
  const handleEnrichBatch = useCallback(async () => {
    const todo = leads
      .filter((l) => l.instagram === undefined && l.website)
      .slice(0, APP_CONFIG.ENRICH_BATCH_MAX);
    if (todo.length === 0) return;
    setEnriching(true);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: todo.map((l) => ({ id: l.id, website: l.website })) }),
      });
      const data = await res.json();
      const map = new Map<string, string | null>(
        (data.results ?? []).map((r: { id: string; instagram: string | null }) => [r.id, r.instagram]),
      );
      const cache = readJson<EnrichCache>(STORAGE_KEYS.enrichCache, {});
      setLeads((prev) =>
        prev.map((l) => {
          if (map.has(l.id)) {
            const ig = map.get(l.id) ?? null;
            cache[l.id] = ig;
            return rescore({ ...l, instagram: ig });
          }
          return l;
        }),
      );
      writeJson(STORAGE_KEYS.enrichCache, cache);
    } catch {
      /* still */
    } finally {
      setEnriching(false);
    }
  }, [leads, rescore]);

  // ---- Indeed-Haken ----
  const handleToggleIndeed = useCallback(
    (lead: Lead) => {
      setLeadEverywhere(rescore({ ...lead, indeedFlag: !lead.indeedFlag }));
    },
    [rescore, setLeadEverywhere],
  );

  // ---- Pipeline lesen ----
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

  // ---- In Pipeline uebernehmen ----
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

  // ---- Status zuruecksetzen ----
  const handleChangeStatus = useCallback(
    async (pageId: string, status: PipelineStatus) => {
      setPipeline((prev) =>
        prev.map((l) => (l.notionPageId === pageId ? { ...l, status } : l)),
      );
      setSelected((prev) =>
        prev && prev.notionPageId === pageId ? { ...prev, status } : prev,
      );
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
        loadPipeline(); // resync
      }
    },
    [loadPipeline],
  );

  // ---- Export ----
  const handleExportCsv = useCallback(() => {
    if (leads.length === 0) return;
    downloadFile(
      `lead-radar-${new Date().toISOString().slice(0, 10)}.csv`,
      leadsToCsv(leads),
      "text/csv;charset=utf-8",
    );
  }, [leads]);

  // ---- HUD-Zaehler ----
  const counts = useMemo(() => {
    let hot = 0,
      warm = 0,
      cold = 0;
    for (const l of leads) {
      if (l.score.rating === "HOT") hot++;
      else if (l.score.rating === "WARM") warm++;
      else cold++;
    }
    return { hot, warm, cold };
  }, [leads]);

  const toggleCategory = (id: string) =>
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );

  return (
    <div className="flex h-full flex-col">
      {booting && <BootSequence onDone={() => setBooting(false)} />}

      <Hud
        view={view}
        onViewChange={setView}
        scanned={leads.length}
        hot={counts.hot}
        warm={counts.warm}
        cold={counts.cold}
        apiCalls={requestCount}
        pipeline={pipeline.length}
        scanning={scanning}
      />

      <div className="relative flex-1 overflow-hidden">
        {/* MAP */}
        <div className={view === "map" ? "h-full" : "hidden"}>
          <MapView
            leads={leads}
            origin={origin}
            radiusKm={radiusKm}
            scanning={scanning}
            onSetOrigin={setOrigin}
            onSelectLead={setSelected}
          />
          <div className="absolute left-3 top-3 z-20">
            <SearchPanel
              selected={categories}
              onToggle={toggleCategory}
              radiusKm={radiusKm}
              onRadius={setRadiusKm}
              onScan={handleScan}
              scanning={scanning}
              origin={origin}
              resultCount={leads.length}
              errors={scanErrors}
              onEnrichAll={handleEnrichBatch}
              enriching={enriching}
              onExportCsv={handleExportCsv}
            />
          </div>
        </div>

        {/* LIST */}
        {view === "list" && (
          <LeadList leads={leads} onSelect={setSelected} selectedId={selected?.id} />
        )}

        {/* PIPELINE */}
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

        {/* DRAWER */}
        {selected && (
          <LeadDrawer
            lead={selected}
            onClose={() => setSelected(null)}
            onAddToPipeline={handleAddToPipeline}
            onEnrich={handleEnrichOne}
            onToggleIndeed={handleToggleIndeed}
            enriching={enrichingId === selected.id}
            addingToPipeline={addingToPipeline}
            pipelineError={pipelineActionError}
          />
        )}
      </div>
    </div>
  );
}
