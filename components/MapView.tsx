"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Lead } from "@/lib/types";
import { APP_CONFIG } from "@/lib/constants";

const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const CLUSTER_PX = 46; // Pixel-Rasterweite fuer einfaches Clustering

interface MapViewProps {
  leads: Lead[];
  origin: { lat: number; lng: number } | null;
  radiusKm: number;
  scanning: boolean;
  onSetOrigin: (o: { lat: number; lng: number }) => void;
  onSelectLead: (lead: Lead) => void;
}

/** Naeherungsweise Kreis-Polygon-Koordinaten (equirektangular, fuer kleine Radien gut genug). */
function circlePolygon(lat: number, lng: number, km: number, n = 64): number[][] {
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const coords: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return coords;
}

export default function MapView(props: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Aktuelle Werte fuer Event-Closures
  const leadsRef = useRef(props.leads);
  const originRef = useRef(props.origin);
  const radiusRef = useRef(props.radiusKm);
  const scanningRef = useRef(props.scanning);
  const onSelectRef = useRef(props.onSelectLead);
  const onSetOriginRef = useRef(props.onSetOrigin);

  const [sweep, setSweep] = useState<{ x: number; y: number; r: number } | null>(null);

  useEffect(() => {
    onSelectRef.current = props.onSelectLead;
    onSetOriginRef.current = props.onSetOrigin;
  });

  // ---- Marker (mit einfachem Grid-Clustering) neu zeichnen ----
  function renderMarkers() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const leads = leadsRef.current;
    if (leads.length === 0) return;

    const cells = new Map<string, Lead[]>();
    for (const lead of leads) {
      const p = map.project([lead.lng, lead.lat]);
      const key = `${Math.floor(p.x / CLUSTER_PX)}:${Math.floor(p.y / CLUSTER_PX)}`;
      const arr = cells.get(key);
      if (arr) arr.push(lead);
      else cells.set(key, [lead]);
    }

    for (const group of cells.values()) {
      if (group.length === 1) {
        const lead = group[0];
        const el = document.createElement("div");
        el.className = `lr-pin lr-pin--${lead.score.rating.toLowerCase()}`;
        el.title = `${lead.name} (${lead.score.rating} ${lead.score.final})`;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(lead);
        });
        markersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat([lead.lng, lead.lat]).addTo(map),
        );
      } else {
        const avgLng = group.reduce((s, l) => s + l.lng, 0) / group.length;
        const avgLat = group.reduce((s, l) => s + l.lat, 0) / group.length;
        const hot = group.some((l) => l.score.rating === "HOT");
        const el = document.createElement("div");
        el.className = "lr-cluster";
        el.textContent = String(group.length);
        if (hot) el.style.borderColor = "var(--hot)";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          map.easeTo({ center: [avgLng, avgLat], zoom: Math.min(18, map.getZoom() + 2) });
        });
        markersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat([avgLng, avgLat]).addTo(map),
        );
      }
    }
  }

  // ---- Radar-Sweep-Geometrie aktualisieren ----
  function updateSweep() {
    const map = mapRef.current;
    const origin = originRef.current;
    if (!map || !scanningRef.current || !origin) {
      setSweep(null);
      return;
    }
    const c = map.project([origin.lng, origin.lat]);
    const dLat = radiusRef.current / 110.574;
    const top = map.project([origin.lng, origin.lat + dLat]);
    const r = Math.hypot(top.x - c.x, top.y - c.y);
    setSweep({ x: c.x, y: c.y, r });
  }

  // ---- Radius-Kreis aktualisieren ----
  function updateCircle() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const origin = originRef.current;
    const src = map.getSource("lr-radius") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "Feature",
      geometry: origin
        ? { type: "Polygon", coordinates: [circlePolygon(origin.lat, origin.lng, radiusRef.current)] }
        : { type: "Polygon", coordinates: [[]] },
      properties: {},
    });
  }

  // ---- Init (einmalig) ----
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const start = props.origin ?? APP_CONFIG.DEFAULT_CENTER;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      center: [start.lng, start.lat],
      zoom: APP_CONFIG.DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      loadedRef.current = true;
      map.addSource("lr-radius", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Polygon", coordinates: [[]] }, properties: {} },
      });
      map.addLayer({
        id: "lr-radius-fill",
        type: "fill",
        source: "lr-radius",
        paint: { "fill-color": "#39ff8b", "fill-opacity": 0.06 },
      });
      map.addLayer({
        id: "lr-radius-line",
        type: "line",
        source: "lr-radius",
        paint: { "line-color": "#39ff8b", "line-width": 1, "line-dasharray": [3, 3], "line-opacity": 0.6 },
      });
      updateCircle();
      renderMarkers();
    });

    map.on("click", (e) => {
      onSetOriginRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    map.on("moveend", () => {
      renderMarkers();
      updateSweep();
    });
    map.on("move", () => updateSweep());

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Leads geaendert ----
  useEffect(() => {
    leadsRef.current = props.leads;
    renderMarkers();
  }, [props.leads]);

  // ---- Origin geaendert: Marker + Kreis ----
  useEffect(() => {
    originRef.current = props.origin;
    updateCircle();
    updateSweep();

    const map = mapRef.current;
    if (!map) return;
    if (props.origin) {
      if (!originMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "lr-origin";
        el.innerHTML =
          '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#39ff8b" stroke-width="1.5">' +
          '<circle cx="12" cy="12" r="6"/><line x1="12" y1="0" x2="12" y2="6"/>' +
          '<line x1="12" y1="18" x2="12" y2="24"/><line x1="0" y1="12" x2="6" y2="12"/>' +
          '<line x1="18" y1="12" x2="24" y2="12"/><circle cx="12" cy="12" r="1.5" fill="#39ff8b"/></svg>';
        const marker = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat([props.origin.lng, props.origin.lat])
          .addTo(map);
        marker.on("dragend", () => {
          const ll = marker.getLngLat();
          onSetOriginRef.current({ lat: ll.lat, lng: ll.lng });
        });
        originMarkerRef.current = marker;
      } else {
        originMarkerRef.current.setLngLat([props.origin.lng, props.origin.lat]);
      }
    }
  }, [props.origin]);

  // ---- Radius geaendert ----
  useEffect(() => {
    radiusRef.current = props.radiusKm;
    updateCircle();
    updateSweep();
  }, [props.radiusKm]);

  // ---- Scanning geaendert ----
  useEffect(() => {
    scanningRef.current = props.scanning;
    updateSweep();
  }, [props.scanning]);

  return (
    <div className="relative h-full w-full crosshair-map">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Radar-Sweep-Overlay */}
      {sweep && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: sweep.x - sweep.r,
            top: sweep.y - sweep.r,
            width: sweep.r * 2,
            height: sweep.r * 2,
          }}
        >
          <div className="absolute inset-0 rounded-full border border-phosphor/40" />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(57,255,139,0) 0deg, rgba(57,255,139,0) 300deg, rgba(57,255,139,0.35) 358deg, rgba(57,255,139,0.6) 360deg)",
              animation: "radar-sweep 1.6s linear infinite",
              maskImage: "radial-gradient(circle, #000 0%, #000 99%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(circle, #000 0%, #000 99%, transparent 100%)",
            }}
          />
        </div>
      )}

      {/* Karten-Eck-HUD */}
      <div className="pointer-events-none absolute left-3 bottom-3 z-10 text-[10px] tracking-widest text-phosphor-muted/70">
        CARTO DARK-MATTER // MAPLIBRE-GL
      </div>
    </div>
  );
}
