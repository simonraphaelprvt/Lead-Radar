"use client";

import { useMemo, useState } from "react";
import type { Lead, Einstufung, PainMatch } from "@/lib/types";
import { EinstufungBadge, TierBadge, PainMatchBadge, PAIN_COLOR, EINSTUFUNG_COLOR } from "./Badges";

type SortKey = "substanz" | "name" | "reviewCount" | "rating" | "kapital";

// Smarte Fokus-Presets: kombinieren beide Achsen in einem Klick.
type PresetKey = "go" | "warn" | "capital";
const PRESETS: { key: PresetKey; label: string; hint: string }[] = [
  { key: "go", label: "Beste", hint: "HOT/WARM × Pain-Match hoch oder mittel — direkt anschreiben" },
  { key: "warn", label: "⚠ Kein Pain", hint: "Formal stark (HOT/WARM), aber Pain-Match niedrig — Vorsicht" },
  { key: "capital", label: "Kapitalstark", hint: "Pain-Match hoch — holt auch Tier-C-Perlen auf Eis hoch" },
];

function matchesPreset(l: Lead, p: PresetKey): boolean {
  const hotWarm = l.einstufung === "HOT" || l.einstufung === "WARM";
  if (p === "go") return hotWarm && (l.painMatch.level === "hoch" || l.painMatch.level === "mittel");
  if (p === "warn") return hotWarm && l.painMatch.level === "niedrig";
  return l.einstufung !== "RAUS" && l.painMatch.level === "hoch"; // capital
}

export default function LeadList({
  leads,
  onSelect,
  selectedId,
}: {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  selectedId?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("substanz");
  const [asc, setAsc] = useState(false);
  const [filter, setFilter] = useState<Einstufung | "ALL">("ALL");
  const [painFilter, setPainFilter] = useState<PainMatch | "ALL">("ALL");
  const [preset, setPreset] = useState<PresetKey | null>(null);
  const [search, setSearch] = useState("");

  const anyActive = preset !== null || filter !== "ALL" || painFilter !== "ALL" || search !== "";

  function pickEinstufung(e: Einstufung | "ALL") {
    setPreset(null);
    setFilter(e);
  }
  function pickPain(p: PainMatch | "ALL") {
    setPreset(null);
    setPainFilter(p);
  }
  function pickPreset(p: PresetKey) {
    setFilter("ALL");
    setPainFilter("ALL");
    setPreset((cur) => (cur === p ? null : p));
  }
  function resetFilters() {
    setPreset(null);
    setFilter("ALL");
    setPainFilter("ALL");
    setSearch("");
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = leads.filter((l) => {
      if (q && !l.name.toLowerCase().includes(q)) return false;
      if (preset) return matchesPreset(l, preset);
      if (filter !== "ALL" && l.einstufung !== filter) return false;
      if (painFilter !== "ALL" && l.painMatch.level !== painFilter) return false;
      return true;
    });
    const val = (l: Lead): number | string =>
      sortKey === "name"
        ? l.name.toLowerCase()
        : sortKey === "reviewCount"
          ? l.reviewCount ?? 0
          : sortKey === "rating"
            ? l.rating ?? 0
            : sortKey === "kapital"
              ? l.painMatch.kapital_score
              : l.substanzScore;
    return [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
  }, [leads, sortKey, asc, filter, painFilter, preset, search]);

  const painCounts = useMemo(() => {
    const c = { hoch: 0, mittel: 0, niedrig: 0 };
    for (const l of leads) if (l.einstufung !== "RAUS") c[l.painMatch.level]++;
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
            <button
              onClick={resetFilters}
              className="text-[10px] text-phosphor-muted hover:text-phosphor-text"
            >
              zurücksetzen ✕
            </button>
          )}
          <span className="ml-auto flex items-center gap-2 font-mono text-[10px] tabular-nums">
            <span title="Pain-Match-Verteilung (ohne RAUS)" className="text-phosphor-muted">PM</span>
            <span style={{ color: PAIN_COLOR.hoch }}>{painCounts.hoch}</span>
            <span style={{ color: PAIN_COLOR.mittel }}>{painCounts.mittel}</span>
            <span style={{ color: PAIN_COLOR.niedrig }}>{painCounts.niedrig}</span>
            <span className="ml-1 text-phosphor-muted">· {rows.length} Leads</span>
          </span>
        </div>

        {/* Zeile 2: zwei Achsen-Filter (deaktiviert-Look, wenn ein Preset aktiv ist) */}
        <div className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 pb-2.5 ${preset ? "opacity-40" : ""}`}>
          <div className="flex items-center gap-1">
            <span className="mr-1 text-[9px] uppercase tracking-wide text-phosphor-muted">Einstufung</span>
            {(["ALL", "HOT", "WARM", "COLD", "RAUS"] as const).map((f) => {
              const active = preset === null && filter === f;
              const c = f === "ALL" ? null : EINSTUFUNG_COLOR[f];
              return (
                <button
                  key={f}
                  onClick={() => pickEinstufung(f)}
                  className={`rounded px-2 py-0.5 font-mono text-[10px] tracking-wide transition-colors ${
                    active && c
                      ? ""
                      : active
                        ? "bg-phosphor-dim/30 text-phosphor-text"
                        : "text-phosphor-muted hover:text-phosphor-text"
                  }`}
                  style={active && c ? { color: c, background: `${c}1f` } : undefined}
                >
                  {f}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <span className="mr-1 text-[9px] uppercase tracking-wide text-phosphor-muted">Pain-Match</span>
            {(["ALL", "hoch", "mittel", "niedrig"] as const).map((p) => {
              const active = preset === null && painFilter === p;
              const c = p === "ALL" ? null : PAIN_COLOR[p];
              const label = p === "ALL" ? "ALL" : p.toUpperCase();
              return (
                <button
                  key={p}
                  onClick={() => pickPain(p)}
                  className={`rounded px-2 py-0.5 font-mono text-[10px] tracking-wide transition-colors ${
                    active && c
                      ? ""
                      : active
                        ? "bg-phosphor-dim/30 text-phosphor-text"
                        : "text-phosphor-muted hover:text-phosphor-text"
                  }`}
                  style={active && c ? { color: c, background: `${c}1f` } : undefined}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-terminal-border">
            <Th k="name" label="NAME" />
            <th className="px-3 py-2 text-left text-[10px] font-medium tracking-wide text-phosphor-muted">
              BRANCHE
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium tracking-wide text-phosphor-muted">
              TIER
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium tracking-wide text-phosphor-muted">
              EINSTUFUNG
            </th>
            <Th k="kapital" label="PAIN-MATCH" />
            <Th k="substanz" label="SUBSTANZ" />
            <Th k="rating" label="★" />
            <Th k="reviewCount" label="REVIEWS" />
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
                <td className="px-3 py-2 text-[13px] text-phosphor-text max-w-[240px] truncate">
                  {l.name}
                </td>
                <td className="px-3 py-2 text-[11px] text-phosphor-muted">{l.categoryLabel}</td>
                <td className="px-3 py-2">
                  <TierBadge t={l.tier} onHold={l.tierCOnHold} />
                </td>
                <td className="px-3 py-2">
                  <EinstufungBadge e={l.einstufung} />
                </td>
                <td className="px-3 py-2">
                  {raus ? (
                    <span className="font-mono text-[11px] text-phosphor-dimtext">–</span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <PainMatchBadge p={l.painMatch.level} />
                      <span className="font-mono text-[11px] tabular-nums text-phosphor-muted">
                        {l.painMatch.kapital_score}
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-[12px] font-semibold tabular-nums text-phosphor-text">
                  {raus ? "–" : l.substanzScore}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-phosphor-muted">
                  {l.rating != null ? l.rating.toFixed(1) : "–"}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-phosphor-muted">
                  {l.reviewCount ?? "–"}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-10 text-center text-phosphor-muted text-xs">
                Keine Leads. Erst einen Scan im Karten-Modus starten.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
