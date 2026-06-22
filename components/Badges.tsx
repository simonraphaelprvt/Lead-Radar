"use client";

import type { Einstufung, Tier, PainWeight } from "@/lib/types";
import { EINSTUFUNG_LABEL } from "@/lib/constants";

/** Oberindikator-Farben: IN NEED rot, INTERESTED orange, COMMON blau, RAUS ausgegraut. */
export const EINSTUFUNG_COLOR: Record<Einstufung, string> = {
  IN_NEED: "var(--in-need)",
  INTERESTED: "var(--interested)",
  COMMON: "var(--common)",
  RAUS: "var(--raus)",
};

/** Gewichts-Farbe fuer Pain-Signale (Detail-Ansicht). */
export const PAIN_WEIGHT_COLOR: Record<PainWeight, string> = {
  hoch: "var(--in-need)",
  mittel: "var(--interested)",
  niedrig: "var(--common)",
};

/** EINZIGER Oberindikator-Marker: Farbe als Rand + leichte Fuellung. */
export function EinstufungBadge({ e, className = "" }: { e: Einstufung; className?: string }) {
  const c = EINSTUFUNG_COLOR[e];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${className}`}
      style={{ color: c, border: `1px solid ${c}59`, background: `${c}14` }}
    >
      {EINSTUFUNG_LABEL[e]}
    </span>
  );
}

/** Tier-Chip, dezent (Farbe traegt der Oberindikator, nicht das Tier). */
export function TierBadge({ t, onHold }: { t: Tier; onHold?: boolean }) {
  return (
    <span className="inline-flex items-center rounded border border-terminal-border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide text-phosphor-muted">
      {t}
      {onHold ? " · off" : ""}
    </span>
  );
}
