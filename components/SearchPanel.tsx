"use client";

import { categoriesForUI } from "@/lib/categories";
import { APP_CONFIG } from "@/lib/constants";

interface SearchPanelProps {
  selected: string[];
  onToggle: (id: string) => void;
  radiusKm: number;
  onRadius: (km: number) => void;
  onScan: () => void;
  scanning: boolean;
  origin: { lat: number; lng: number } | null;
  resultCount: number;
  errors: string[];
  onEnrichAll: () => void;
  enriching: boolean;
  onExportCsv: () => void;
}

const GROUP_LABELS: Record<string, string> = {
  core: "KERNBRANCHEN",
  adjacent: "ANGRENZEND",
  low: "NIEDRIGE ZAHLUNGSKRAFT",
};

export default function SearchPanel(props: SearchPanelProps) {
  const cats = categoriesForUI();
  const groups: Record<string, typeof cats> = { core: [], adjacent: [], low: [] };
  for (const c of cats) groups[c.group].push(c);

  return (
    <div className="panel corner-brackets w-[300px] max-h-[calc(100vh-110px)] overflow-y-auto p-3 text-sm">
      <div className="text-[11px] tracking-widest text-phosphor mb-2 glow-text">
        ⊹ SUCH-PARAMETER
      </div>

      {/* Position */}
      <div className="mb-3 text-[10px] text-phosphor-muted">
        ZIELPUNKT:{" "}
        {props.origin ? (
          <span className="text-phosphor-text tabular-nums">
            {props.origin.lat.toFixed(4)}, {props.origin.lng.toFixed(4)}
          </span>
        ) : (
          <span className="text-status-warm">auf Karte setzen (Klick)</span>
        )}
      </div>

      {/* Radius */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] tracking-widest text-phosphor-muted mb-1">
          <span>RADIUS</span>
          <span className="text-phosphor-text tabular-nums">{props.radiusKm} km</span>
        </div>
        <input
          type="range"
          min={APP_CONFIG.MIN_RADIUS_KM}
          max={APP_CONFIG.MAX_RADIUS_KM}
          step={1}
          value={props.radiusKm}
          onChange={(e) => props.onRadius(Number(e.target.value))}
          className="w-full accent-[#39ff8b]"
        />
      </div>

      {/* Kategorien */}
      <div className="mb-3">
        <div className="text-[10px] tracking-widest text-phosphor-muted mb-2">
          BRANCHEN ({props.selected.length})
        </div>
        {(["core", "adjacent", "low"] as const).map((g) => (
          <div key={g} className="mb-2">
            <div className="text-[9px] tracking-widest text-phosphor-dim mb-1">
              {GROUP_LABELS[g]}
            </div>
            <div className="flex flex-wrap gap-1">
              {groups[g].map((c) => {
                const on = props.selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => props.onToggle(c.id)}
                    className={`px-2 py-1 text-[10px] border transition-colors ${
                      on
                        ? "border-phosphor text-phosphor bg-phosphor-dim/20"
                        : "border-terminal-border text-phosphor-muted hover:border-phosphor-dim"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Scan */}
      <button
        onClick={props.onScan}
        disabled={props.scanning || !props.origin || props.selected.length === 0}
        className="w-full py-2 mb-2 text-xs tracking-[0.25em] font-bold border border-phosphor text-phosphor hover:bg-phosphor-dim/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {props.scanning ? "◈ SCANNE GEBIET ..." : "▶ SCAN STARTEN"}
      </button>

      {/* Aktionen nach Scan */}
      {props.resultCount > 0 && (
        <div className="flex gap-2">
          <button
            onClick={props.onEnrichAll}
            disabled={props.enriching}
            className="flex-1 py-1.5 text-[10px] tracking-widest border border-terminal-border text-phosphor-muted hover:border-phosphor-dim hover:text-phosphor-text disabled:opacity-40"
          >
            {props.enriching ? "ANREICHERN ..." : "⊕ INSTAGRAM-BATCH"}
          </button>
          <button
            onClick={props.onExportCsv}
            className="flex-1 py-1.5 text-[10px] tracking-widest border border-terminal-border text-phosphor-muted hover:border-phosphor-dim hover:text-phosphor-text"
          >
            ⤓ CSV
          </button>
        </div>
      )}

      {props.resultCount > 0 && (
        <div className="mt-2 text-[10px] text-phosphor-muted">
          {props.resultCount} Treffer im Cache.
        </div>
      )}

      {props.errors.length > 0 && (
        <div className="mt-2 text-[10px] text-status-hot/80">
          {props.errors.slice(0, 3).map((e, i) => (
            <div key={i}>! {e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
