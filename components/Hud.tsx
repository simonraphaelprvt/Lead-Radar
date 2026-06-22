"use client";

import ViewSwitcher, { type AppView } from "./ViewSwitcher";

interface HudProps {
  view: AppView;
  onViewChange: (v: AppView) => void;
  scanned: number;
  inNeed: number;
  interested: number;
  common: number;
  raus: number;
  pipeline: number;
  scanning: boolean;
}

function Stat({
  label,
  value,
  color = "var(--text)",
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="px-3.5 border-l border-terminal-border first:border-l-0">
      <div className="text-[9px] tracking-wide text-phosphor-muted">{label}</div>
      <div className="font-mono text-[15px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}


export default function Hud(props: HudProps) {
  return (
    <header className="panel relative z-20 flex items-center justify-between gap-4 px-4 py-2.5 border-b">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block h-2 w-2 rounded-full transition-colors"
            style={{ background: props.scanning ? "var(--accent)" : "var(--dim)" }}
          />
          <span className="text-[15px] font-semibold tracking-tight text-phosphor-text">
            Lead Radar
          </span>
        </div>
        <span className="hidden md:inline text-[11px] text-phosphor-muted">
          {props.scanning ? "Scan läuft …" : "Signalbasierte Qualifizierung"}
        </span>
      </div>

      <div className="flex items-center">
        <Stat label="GESCANNT" value={props.scanned} />
        <Stat label="IN NEED" value={props.inNeed} color="var(--in-need)" />
        <Stat label="INTERESTED" value={props.interested} color="var(--interested)" />
        <Stat label="COMMON" value={props.common} color="var(--common)" />
        <Stat label="RAUS" value={props.raus} color="var(--dim)" />
        <Stat label="PIPELINE" value={props.pipeline} color="var(--accent)" />
      </div>

      <ViewSwitcher view={props.view} onChange={props.onViewChange} />
    </header>
  );
}
