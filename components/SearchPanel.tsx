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
  onExportCsv: () => void;
  filterChains: boolean;
  onToggleChains: () => void;
}

// "low" (niedrige Zahlungskraft) bewusst NICHT mehr anbieten.
const GROUP_LABELS: Record<string, string> = {
  core: "Kernbranchen",
  adjacent: "Angrenzend",
  b2b: "B2B",
};
const GROUP_ORDER = ["core", "adjacent", "b2b"] as const;

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${
        on ? "bg-phosphor" : "bg-terminal-panel-2 border border-terminal-border"
      }`}
    >
      <span
        className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white transition-all ${
          on ? "left-[15px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}

export default function SearchPanel(props: SearchPanelProps) {
  const cats = categoriesForUI();
  const groups: Record<string, typeof cats> = { core: [], adjacent: [], b2b: [] };
  for (const c of cats) if (c.group in groups) groups[c.group].push(c);

  return (
    <div className="panel w-[300px] max-h-[calc(100vh-104px)] overflow-y-auto rounded-xl p-4 text-sm shadow-2xl">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-phosphor-muted">
        Suchparameter
      </div>

      <div className="mb-4 text-[11px] text-phosphor-muted">
        Zielpunkt:{" "}
        {props.origin ? (
          <span className="font-mono text-phosphor-text tabular-nums">
            {props.origin.lat.toFixed(4)}, {props.origin.lng.toFixed(4)}
          </span>
        ) : (
          <span className="text-status-warm">auf Karte setzen (Klick)</span>
        )}
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex justify-between text-[11px] text-phosphor-muted">
          <span>Radius</span>
          <span className="font-mono text-phosphor-text tabular-nums">{props.radiusKm} km</span>
        </div>
        <input
          type="range"
          min={APP_CONFIG.MIN_RADIUS_KM}
          max={APP_CONFIG.MAX_RADIUS_KM}
          step={1}
          value={props.radiusKm}
          onChange={(e) => props.onRadius(Number(e.target.value))}
          className="w-full accent-[#6E92C9]"
        />
      </div>

      {/* Ketten-Filter */}
      <div className="mb-4 flex items-center justify-between rounded-md border border-terminal-border px-3 py-2">
        <div>
          <div className="text-[12px] text-phosphor-text">Ketten ausblenden</div>
          <div className="text-[10px] text-phosphor-dimtext">Filialen & Franchise als RAUS</div>
        </div>
        <Switch on={props.filterChains} onClick={props.onToggleChains} />
      </div>

      <div className="mb-4">
        <div className="mb-2 text-[11px] text-phosphor-muted">
          Branchen ({props.selected.length})
        </div>
        {GROUP_ORDER.map((g) => (
          <div key={g} className="mb-2.5">
            <div className="mb-1.5 text-[9px] uppercase tracking-wide text-phosphor-dimtext">
              {GROUP_LABELS[g]}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {groups[g].map((c) => {
                const on = props.selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => props.onToggle(c.id)}
                    className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                      on
                        ? "bg-phosphor-dim/40 text-phosphor-text"
                        : "border border-terminal-border text-phosphor-muted hover:text-phosphor-text"
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

      <button
        onClick={props.onScan}
        disabled={props.scanning || !props.origin || props.selected.length === 0}
        className="mb-2 w-full rounded-lg py-2.5 text-[13px] font-medium text-white transition-colors bg-phosphor hover:brightness-110 disabled:bg-terminal-panel-2 disabled:text-phosphor-muted disabled:cursor-not-allowed"
      >
        {props.scanning ? "Scanne Gebiet …" : "Scan starten"}
      </button>

      {props.resultCount > 0 && (
        <button
          onClick={props.onExportCsv}
          className="w-full rounded-md border border-terminal-border py-1.5 text-[11px] text-phosphor-muted hover:text-phosphor-text"
        >
          ↓ CSV exportieren
        </button>
      )}

      {props.resultCount > 0 && (
        <div className="mt-2 text-[11px] text-phosphor-muted">
          {props.resultCount} qualifizierte Treffer.
        </div>
      )}

      {props.errors.length > 0 && (
        <div className="mt-2 space-y-0.5 text-[11px] text-status-hot/80">
          {props.errors.slice(0, 3).map((e, i) => (
            <div key={i}>! {e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
