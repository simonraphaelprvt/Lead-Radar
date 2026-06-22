"use client";

import type { Einstufung, Tier, PainMatch } from "@/lib/types";

export const EINSTUFUNG_COLOR: Record<Einstufung, string> = {
  HOT: "var(--hot)",
  WARM: "var(--warm)",
  COLD: "var(--cold)",
  RAUS: "var(--raus)",
};

// Pain-Match-Farben: entsaettigt, im Studio-Stil. Gruen = Wert/Go,
// Sand = mittel (= warm), Grau = niedrig (= cold).
export const PAIN_COLOR: Record<PainMatch, string> = {
  hoch: "#5E9C7A",
  mittel: "var(--warm)",
  niedrig: "var(--cold)",
};

const PAIN_LABEL: Record<PainMatch, string> = {
  hoch: "HOCH",
  mittel: "MITTEL",
  niedrig: "NIEDRIG",
};

/** Pain-Match-Marker (zweite Achse): ruhiger Rand + leichte Fuellung. */
export function PainMatchBadge({ p, className = "" }: { p: PainMatch; className?: string }) {
  const c = PAIN_COLOR[p];
  return (
    <span
      title="Pain-Match: Kapital × Lösbarkeit (Anlass im Erstkontakt prüfen)"
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${className}`}
      style={{ color: c, border: `1px solid ${c}59`, background: `${c}14` }}
    >
      PM {PAIN_LABEL[p]}
    </span>
  );
}

/** Ruhiger Status-Marker: Farbe als Rand + leichte Fuellung, kein Vollflaechen-Schrei. */
export function EinstufungBadge({ e, className = "" }: { e: Einstufung; className?: string }) {
  const c = EINSTUFUNG_COLOR[e];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${className}`}
      style={{ color: c, border: `1px solid ${c}59`, background: `${c}14` }}
    >
      {e}
    </span>
  );
}

/** Tier-Chip, dezent (Farbe traegt die Einstufung, nicht das Tier). */
export function TierBadge({ t, onHold }: { t: Tier; onHold?: boolean }) {
  return (
    <span className="inline-flex items-center rounded border border-terminal-border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide text-phosphor-muted">
      {t}
      {onHold ? " · hold" : ""}
    </span>
  );
}
