"use client";

// ====================================================================
// SatelliteThumb - statisches Luftbild eines Standorts ohne Karten-Library.
// Nutzt dieselben Esri-World-Imagery-Kacheln wie die Hauptkarte. Rechnet die
// globale Pixelposition von (lat,lng) im Web-Mercator aus und legt so viele
// 256px-Kacheln, dass der Punkt exakt in der Mitte des Rahmens sitzt.
// Komplett kostenlos, kein Key. Jeder Lead hat damit IMMER ein Bild.
// ====================================================================

const ESRI =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

const TILE = 256;

function lngToWorldX(lng: number, z: number): number {
  return ((lng + 180) / 360) * Math.pow(2, z) * TILE;
}
function latToWorldY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return (
    ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * Math.pow(2, z) * TILE
  );
}

interface Props {
  lat: number;
  lng: number;
  /** HOT/WARM/COLD Markerfarbe. */
  markerColor?: string;
  zoom?: number;
  height?: number;
  /** Designbreite des Kachel-Canvas (wird im w-full Container zentriert geklippt). */
  width?: number;
  className?: string;
}

export default function SatelliteThumb({
  lat,
  lng,
  markerColor = "#4d8df0",
  zoom = 17,
  height = 168,
  width = 416,
  className = "",
}: Props) {
  const z = zoom;
  const px = lngToWorldX(lng, z);
  const py = latToWorldY(lat, z);
  // Linke/obere Kante des Canvas in globalen Pixeln, sodass der Punkt mittig liegt.
  const originX = px - width / 2;
  const originY = py - height / 2;

  const t0x = Math.floor(originX / TILE);
  const t1x = Math.floor((originX + width) / TILE);
  const t0y = Math.floor(originY / TILE);
  const t1y = Math.floor((originY + height) / TILE);

  const tiles: { key: string; src: string; left: number; top: number }[] = [];
  for (let tx = t0x; tx <= t1x; tx++) {
    for (let ty = t0y; ty <= t1y; ty++) {
      tiles.push({
        key: `${tx}-${ty}`,
        src: `${ESRI}/${z}/${ty}/${tx}`,
        left: tx * TILE - originX,
        top: ty * TILE - originY,
      });
    }
  }

  return (
    <div
      className={`relative w-full overflow-hidden bg-terminal-panel-2 ${className}`}
      style={{ height }}
    >
      {/* Zentriertes Kachel-Canvas (bei schmalem Container werden die Raender geklippt) */}
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2"
        style={{ width, height }}
      >
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t.key}
            src={t.src}
            alt=""
            width={TILE}
            height={TILE}
            loading="lazy"
            draggable={false}
            className="absolute max-w-none select-none"
            style={{ left: t.left, top: t.top }}
          />
        ))}
      </div>

      {/* Marker exakt in der Mitte */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="h-3 w-3 rounded-full ring-2 ring-black/50"
          style={{ backgroundColor: markerColor, boxShadow: `0 0 0 4px ${markerColor}33` }}
        />
      </div>

      {/* leichte Abdunklung unten fuer Lesbarkeit etwaiger Overlays */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/45 to-transparent" />
    </div>
  );
}
