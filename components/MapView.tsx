"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Lead } from "@/lib/types";
import { APP_CONFIG } from "@/lib/constants";

// Satellitenbild (Esri World Imagery, kostenlos, kein Key) + dezente dunkle
// Ortslabels (CARTO). Raster-Kacheln (kein WebGL) -> browser-robust.
const ESRI =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const CARTO_LABELS = "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png";

interface MapViewProps {
  leads: Lead[];
  origin: { lat: number; lng: number } | null;
  radiusKm: number;
  scanning: boolean;
  selectedId?: string;
  onSetOrigin: (o: { lat: number; lng: number }) => void;
  onSelectLead: (lead: Lead) => void;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

export default function MapView(props: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const pulseRef = useRef<L.Circle | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);

  const leadsRef = useRef(props.leads);
  const originRef = useRef(props.origin);
  const radiusRef = useRef(props.radiusKm);
  const scanningRef = useRef(props.scanning);
  const selectedIdRef = useRef(props.selectedId);
  const onSelectRef = useRef(props.onSelectLead);
  const onSetOriginRef = useRef(props.onSetOrigin);

  useEffect(() => {
    onSelectRef.current = props.onSelectLead;
    onSetOriginRef.current = props.onSetOrigin;
  });

  // ---- Marker neu zeichnen ----
  function renderMarkers() {
    const map = mapRef.current;
    const group = markersRef.current;
    if (!map || !group) return;
    group.clearLayers();

    const selId = selectedIdRef.current;
    for (const lead of leadsRef.current) {
      const isInNeed = lead.einstufung === "IN_NEED";
      const isSel = lead.id === selId;
      const cls = lead.einstufung.toLowerCase(); // in_need|interested|common|raus

      let html = "";
      // Ruhiger Ring nur fuer den ausgewaehlten Pin (kein Dauer-Pulsieren).
      if (isSel) html += '<div class="mk-ring--sel"></div>';
      if (isInNeed || isSel) {
        const name = lead.name.length > 26 ? lead.name.slice(0, 25) + "…" : lead.name;
        const label = lead.einstufung === "IN_NEED" ? "IN NEED"
          : lead.einstufung === "INTERESTED" ? "INTERESTED"
          : lead.einstufung === "COMMON" ? "COMMON" : "RAUS";
        html +=
          `<div class="mk-tag${isInNeed && !isSel ? " mk-tag--hot" : ""}">` +
          `<span class="mk-tag-name">${escapeHtml(name)}</span>` +
          `<span class="mk-tag-meta">${label} · ${lead.finalScore} · ${escapeHtml(lead.categoryLabel)}</span>` +
          `</div>`;
      }
      const icon = L.divIcon({
        html: `<div class="mk mk--${cls}"></div>${html}`,
        className: "mk-wrap",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([lead.lat, lead.lng], { icon, riseOnHover: true });
      marker.on("click", () => onSelectRef.current(lead));
      marker.addTo(group);
    }
  }

  // ---- Radius-Kreis ----
  function updateCircle() {
    const map = mapRef.current;
    if (!map) return;
    const o = originRef.current;
    if (!o) {
      if (circleRef.current) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }
      return;
    }
    const meters = radiusRef.current * 1000;
    if (!circleRef.current) {
      circleRef.current = L.circle([o.lat, o.lng], {
        radius: meters,
        color: "#6E92C9",
        weight: 1,
        opacity: 0.6,
        fillColor: "#6E92C9",
        fillOpacity: 0.05,
        dashArray: "4 4",
        interactive: false,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng([o.lat, o.lng]).setRadius(meters);
    }
  }

  // ---- Scan-Puls (Leaflet-Kreis mit pulsierendem Rand, kein React-Rerender) ----
  function updatePulse() {
    const map = mapRef.current;
    if (!map) return;
    const o = originRef.current;
    const active = scanningRef.current && !!o;
    if (active && o) {
      const meters = radiusRef.current * 1000;
      if (!pulseRef.current) {
        pulseRef.current = L.circle([o.lat, o.lng], {
          radius: meters,
          className: "scan-pulse-circle",
          color: "#6E92C9",
          weight: 2,
          opacity: 0.85,
          fill: false,
          interactive: false,
        }).addTo(map);
      } else {
        pulseRef.current.setLatLng([o.lat, o.lng]).setRadius(meters);
      }
    } else if (pulseRef.current) {
      map.removeLayer(pulseRef.current);
      pulseRef.current = null;
    }
  }

  // ---- Origin-Marker ----
  function updateOrigin() {
    const map = mapRef.current;
    if (!map) return;
    const o = originRef.current;
    if (!o) return;
    if (!originMarkerRef.current) {
      const icon = L.divIcon({
        className: "origin-wrap",
        html:
          '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#6E92C9" stroke-width="1.5">' +
          '<circle cx="12" cy="12" r="6"/><line x1="12" y1="1" x2="12" y2="6"/>' +
          '<line x1="12" y1="18" x2="12" y2="23"/><line x1="1" y1="12" x2="6" y2="12"/>' +
          '<line x1="18" y1="12" x2="23" y2="12"/><circle cx="12" cy="12" r="1.5" fill="#6E92C9"/></svg>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const m = L.marker([o.lat, o.lng], { icon, draggable: true, zIndexOffset: 1000 }).addTo(map);
      m.on("dragend", () => {
        const ll = m.getLatLng();
        onSetOriginRef.current({ lat: ll.lat, lng: ll.lng });
      });
      originMarkerRef.current = m;
    } else {
      originMarkerRef.current.setLatLng([o.lat, o.lng]);
    }
  }

  // ---- Init (einmalig) ----
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const start = props.origin ?? APP_CONFIG.DEFAULT_CENTER;
    const map = L.map(containerRef.current, {
      center: [start.lat, start.lng],
      zoom: APP_CONFIG.DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
    });
    mapRef.current = map;
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.setPrefix(false);

    // Labels in eigene Pane (ueber Satellit, unter Markern).
    map.createPane("labels");
    const lp = map.getPane("labels");
    if (lp) lp.style.zIndex = "350";

    // Leicht abgedunkelt ueber Opacity (dunkler Container scheint durch) statt
    // CSS-Filter -> fluessiges Panning, kein Safari-Ruckeln.
    L.tileLayer(ESRI, {
      maxZoom: 19,
      opacity: 0.9,
      keepBuffer: 2,
      updateWhenIdle: true,
      attribution: "Esri, Maxar, Earthstar Geographics",
    }).addTo(map);
    L.tileLayer(CARTO_LABELS, {
      subdomains: "abcd",
      opacity: 0.6,
      keepBuffer: 2,
      updateWhenIdle: true,
      pane: "labels",
      attribution: "© CARTO",
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onSetOriginRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    updateOrigin();
    updateCircle();
    renderMarkers();

    // Container-Groessenaenderungen abfangen (Leaflet braucht invalidateSize,
    // sonst bleiben Kacheln grau/leer, wenn der Container spaeter Groesse bekommt).
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    // direkt nach dem Mount einmal sicher nachmessen
    setTimeout(() => map.invalidateSize(), 0);
    setTimeout(() => map.invalidateSize(), 250);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    leadsRef.current = props.leads;
    renderMarkers();
  }, [props.leads]);

  useEffect(() => {
    selectedIdRef.current = props.selectedId;
    renderMarkers();
  }, [props.selectedId]);

  useEffect(() => {
    originRef.current = props.origin;
    updateOrigin();
    updateCircle();
    updatePulse();
  }, [props.origin]);

  useEffect(() => {
    radiusRef.current = props.radiusKm;
    updateCircle();
    updatePulse();
  }, [props.radiusKm]);

  useEffect(() => {
    scanningRef.current = props.scanning;
    updatePulse();
  }, [props.scanning]);

  return (
    <div className="relative h-full w-full isolate crosshair-map">
      <div ref={containerRef} className="absolute inset-0" />

    </div>
  );
}
