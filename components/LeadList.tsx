"use client";

import { useMemo, useState } from "react";
import type { Lead, Einstufung } from "@/lib/types";
import { EinstufungBadge, TierBadge, EINSTUFUNG_COLOR } from "./Badges";
import { EINSTUFUNG_LABEL } from "@/lib/constants";

type SortKey = "final" | "name" | "pay" | "need" | "fit" | "pain" | "rating" | "reviewCount";

// Smarte Fokus-Presets auf dem Oberindikator + Rohachsen.
type PresetKey = "anschreiben" | "pain" | "pay";
const PRESETS: { key: PresetKey; label: string; hint: string }[] = [
  { key: "anschreiben", label: "Anschreiben", hint: "IN NEED + INTERESTED — Empfehlung: kontaktieren" },
  { key: "pain", label: "Pain belegt", hint: "Mindestens ein konkret belegtes Pain-Signal" },
  { key: "pay", label: "Kapitalstark", hint: "Zahlungskraft (pay) ≥ 65" },
];

function matchesPreset(l: Lead, p: PresetKey): boolean {
  if (l.einstufung === "RAUS") return false;
  if (p === "anschreiben") return l.einstufung === "IN_NEED" || l.einstufung === "INTERESTED";
  if (p === "pain") return l.painMatchScore > 0;
  return l.payScore >= 65; // pay
}

const STUFEN: (Einstufung | "ALL")[] = ["ALL", "IN_NEED", "INTERESTED", "COMMON", "RAUS"];

export default function LeadList({
  leads,
  onSelect,
  selectedId,
}: {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  selectedId?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("final");
  const [asc, setAsc] = useState(false);
  const [filter, setFilter] = useState<Einstufung | "ALL">("ALL");
  const [preset, setPreset] = useState<PresetKey | null>(null);
  const [search, setSearch] = useState("");

  const anyActive = preset !== null || filter !== "ALL" || search !== "";

  function pickStufe(e: Einstufung | "ALL") {
    setPreset(null);
    setFilter(e);
  }
  function pickPreset(p: PresetKey) {
    setFilter("ALL");
    setPreset((cur) => (cur === p ? null : p));
  }
  function resetFilters() {
    setPreset(null);
    setFilter("ALL");
    setSearch("");
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = leads.filter((l) => {
      if (q && !l.name.toLowerCase().includes(q)) return false;
      if (preset) return matchesPreset(l, preset);
      if (filter !== "ALL" && l.einstufung !== filter) return false;
      return true;
    });
    const val = (l: Lead): number | string =>
      sortKey === "name" ? l.name.toLowerCase()
      : sortKey === "pay" ? l.payScore
      : sortKey === "need" ? l.needScore
      : sortKey === "fit" ? l.fitScore
      : sortKey === "pain" ? l.painMatchScore
      : sortKey === "rating" ? l.rating ?? 0
      : sortKey === "reviewCount" ? l.reviewCount ?? 0
      : l.finalScore;
    return [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
  }, [leads, sortKey, asc, filter, preset, search]);

  const counts = useMemo(() => {
    const c = { IN_NEED: 0, INTERESTED: 0, COMMON: 0 };
    for (const l of leads) if (l.einstufung in c) c[l.einstufung as keyof typeof c]++;
    return c;
  }, [leads]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setAsc((a) => !a);
    else {
      setSortKey(key);
      setAsc(false);
    }
  }

  const Th = ({ k, label, className = "" }: { k: SortKey; label: string; className?: string }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 text-left text-[10px] font-medium tracking-wide text-phosphor-muted cursor-pointer hover:text-phosphor-text select-none ${className}`}
    >
      {label} {sortKey === k ? (asc ? "↑" : "↓") : ""}
    </th>
  );

  /** Eine Rohwert-Zelle mit dezenter Farbskala (hoch = Akzent). */
  const ScoreCell = ({ v, raus }: { v: number; raus: boolean }) => (
    <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-phosphor-muted">
      {raus ? "–" : v}
    </td>
  );

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 panel border-b">
        {/* Zeile 1: Suche + Fokus-Presets + Zähler */}
        <div className="flex items-center gap-2 px-4 pt-2.5 pb-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen …"
            className="w-36 rounded-md border border-terminal-border bg-terminal-panel-2 px-2 py-1 text-[11px] text-phosphor-text placeholder:text-phosphor-dimtext focus:border-phosphor-dim focus:outline-none"
          />
          <span className="ml-1 text-[9px] uppercase tracking-wide text-phosphor-muted">Fokus</span>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => pickPreset(p.key)}
              title={p.hint}
              className={`rounded-md px-2 py-1 text-[10px] tracking-wide transition-colors ${
                preset === p.key
                  ? "bg-phosphor text-white"
                  : "border border-terminal-border text-phosphor-muted hover:text-phosphor-text"
              }`}
            >
              {p.label}
            </button>
          ))}
          {anyActive && (
            <button onClick={resetFilters} className="text-[10px] text-phosphor-muted hover:text-phosphor-text">
              zurücksetzen ✕
            </button>
          )}
          <span className="ml-auto flex items-center gap-2 font-mono text-[10px] tabular-nums">
            <span style={{ color: EINSTUFUNG_COLOR.IN_NEED }} title="IN NEED">{counts.IN_NEED}</span>
            <span style={{ color: EINSTUFUNG_COLOR.INTERESTED }} title="INTERESTED">{counts.INTERESTED}</span>
            <span style={{ color: EINSTUFUNG_COLOR.COMMON }} title="COMMON">{counts.COMMON}</span>
            <span className="ml-1 text-phosphor-muted">· {rows.length} Leads</span>
          </span>
        </div>

        {/* Zeile 2: Stufen-Filter */}
        <div className="flex flex-wrap items-center gap-1 px-4 pb-2.5">
          <span className="mr-1 text-[9px] uppercase tracking-wide text-phosphor-muted">Einstufung</span>
          {STUFEN.map((f) => {
            const active = preset === null && filter === f;
            const c = f === "ALL" ? null : EINSTUFUNG_COLOR[f];
            const label = f === "ALL" ? "ALL" : EINSTUFUNG_LABEL[f];
            return (
              <button
                key={f}
                onClick={() => pickStufe(f)}
                className={`rounded px-2 py-0.5 font-mono text-[10px] tracking-wide transition-colors ${
                  active && c ? "" : active ? "bg-phosphor-dim/30 text-phosphor-text" : "text-phosphor-muted hover:text-phosphor-text"
                }`}
                style={active && c ? { color: c, background: `${c}1f` } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-terminal-border">
            <Th k="name" label="NAME" />
            <th className="px-3 py-2 text-left text-[10px] font-medium tracking-wide text-phosphor-muted">BRANCHE</th>
            <th className="px-3 py-2 text-left text-[10px] font-medium tracking-wide text-phosphor-muted">EINSTUFUNG</th>
            <Th k="final" label="FINAL" />
            <Th k="pay" label="PAY" />
            <Th k="need" label="NEED" />
            <Th k="fit" label="FIT" />
            <Th k="pain" label="PAIN" />
            <th className="px-3 py-2 text-left text-[10px] font-medium tracking-wide text-phosphor-muted">TIER</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const raus = l.einstufung === "RAUS";
            return (
              <tr
                key={l.id}
                onClick={() => onSelect(l)}
                className={`border-b border-terminal-border/50 cursor-pointer transition-colors hover:bg-phosphor-dim/10 ${
                  selectedId === l.id ? "bg-phosphor-dim/20" : ""
                } ${raus ? "opacity-45" : ""}`}
              >
                <td className="px-3 py-2 text-[13px] text-phosphor-text max-w-[220px] truncate">{l.name}</td>
                <td className="px-3 py-2 text-[11px] text-phosphor-muted">{l.categoryLabel}</td>
                <td className="px-3 py-2">
                  <EinstufungBadge e={l.einstufung} />
                </td>
                <td className="px-3 py-2 font-mono text-[12px] font-semibold tabular-nums text-phosphor-text">
                  {raus ? "–" : l.finalScore}
                </td>
                <ScoreCell v={l.payScore} raus={raus} />
                <ScoreCell v={l.needScore} raus={raus} />
                <ScoreCell v={l.fitScore} raus={raus} />
                <ScoreCell v={l.painMatchScore} raus={raus} />
                <td className="px-3 py-2">
                  <TierBadge t={l.tier} onHold={l.tierCOnHold} />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-10 text-center text-phosphor-muted text-xs">
                Keine Leads. Erst einen Scan im Karten-Modus starten.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
