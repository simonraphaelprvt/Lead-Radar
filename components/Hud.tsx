"use client";

import ViewSwitcher, { type AppView } from "./ViewSwitcher";

interface HudProps {
  view: AppView;
  onViewChange: (v: AppView) => void;
  scanned: number;
  hot: number;
  warm: number;
  cold: number;
  apiCalls: number;
  pipeline: number;
  scanning: boolean;
}

function Stat({
  label,
  value,
  color = "var(--phosphor-text)",
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="px-3 border-l border-terminal-border first:border-l-0">
      <div className="text-[9px] tracking-widest text-phosphor-muted">{label}</div>
      <div className="text-base font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export default function Hud(props: HudProps) {
  return (
    <header className="panel relative z-20 flex items-center justify-between gap-4 px-4 py-2 border-b">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              props.scanning ? "bg-status-hot blink" : "bg-phosphor"
            }`}
            style={{ boxShadow: "0 0 8px currentColor" }}
          />
          <span className="text-lg font-bold tracking-[0.3em] text-phosphor glow-text">
            LEAD&nbsp;RADAR
          </span>
        </div>
        <span className="hidden md:inline text-[10px] tracking-widest text-phosphor-muted">
          {props.scanning ? "// SCAN LÄUFT ..." : "// COMMAND-CENTER"}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Stat label="GESCANNT" value={props.scanned} />
        <Stat label="HOT" value={props.hot} color="var(--hot)" />
        <Stat label="WARM" value={props.warm} color="var(--warm)" />
        <Stat label="COLD" value={props.cold} color="var(--cold)" />
        <Stat label="API CALLS" value={props.apiCalls} color="#37c0ff" />
        <Stat label="PIPELINE" value={props.pipeline} color="var(--phosphor)" />
      </div>

      <ViewSwitcher view={props.view} onChange={props.onViewChange} />
    </header>
  );
}
