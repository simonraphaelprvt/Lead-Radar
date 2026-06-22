"use client";

import ViewSwitcher, { type AppView } from "./ViewSwitcher";
import { PAIN_COLOR } from "./Badges";

interface HudProps {
  view: AppView;
  onViewChange: (v: AppView) => void;
  scanned: number;
  hot: number;
  warm: number;
  cold: number;
  raus: number;
  painHoch: number;
  painMittel: number;
  painNiedrig: number;
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

/** Pain-Match-Gruppe: drei Werte unter einem Label, abgesetzt vom Einstufungs-Block. */
function PainGroup({ hoch, mittel, niedrig }: { hoch: number; mittel: number; niedrig: number }) {
  return (
    <div className="ml-1 flex flex-col justify-center border-l border-terminal-border pl-3.5">
      <div className="text-[9px] tracking-wide text-phosphor-muted">PAIN-MATCH</div>
      <div className="flex items-center gap-2 font-mono text-[15px] font-semibold tabular-nums leading-none">
        <span style={{ color: PAIN_COLOR.hoch }} title="Pain-Match Hoch">{hoch}</span>
        <span className="text-[10px] text-phosphor-dimtext">/</span>
        <span style={{ color: PAIN_COLOR.mittel }} title="Pain-Match Mittel">{mittel}</span>
        <span className="text-[10px] text-phosphor-dimtext">/</span>
        <span style={{ color: PAIN_COLOR.niedrig }} title="Pain-Match Niedrig">{niedrig}</span>
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
        <Stat label="HOT" value={props.hot} color="var(--hot)" />
        <Stat label="WARM" value={props.warm} color="var(--warm)" />
        <Stat label="COLD" value={props.cold} color="var(--cold)" />
        <Stat label="RAUS" value={props.raus} color="var(--dim)" />
        <PainGroup hoch={props.painHoch} mittel={props.painMittel} niedrig={props.painNiedrig} />
        <Stat label="PIPELINE" value={props.pipeline} color="var(--accent)" />
      </div>

      <ViewSwitcher view={props.view} onChange={props.onViewChange} />
    </header>
  );
}
