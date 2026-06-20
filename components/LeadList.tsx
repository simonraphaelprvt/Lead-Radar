"use client";

import { useMemo, useState } from "react";
import type { Lead, LeadRating } from "@/lib/types";
import { RatingBadge } from "./ScoreBars";

type SortKey = "final" | "pay" | "need" | "fit" | "name" | "reviewCount";

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
  const [filter, setFilter] = useState<LeadRating | "ALL">("ALL");

  const rows = useMemo(() => {
    let list = leads;
    if (filter !== "ALL") list = list.filter((l) => l.score.rating === filter);
    const sorted = [...list].sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (sortKey === "name") {
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
      } else if (sortKey === "reviewCount") {
        va = a.reviewCount ?? 0;
        vb = b.reviewCount ?? 0;
      } else {
        va = a.score[sortKey];
        vb = b.score[sortKey];
      }
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [leads, sortKey, asc, filter]);

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
      className={`px-3 py-2 text-left text-[10px] tracking-widest text-phosphor-muted cursor-pointer hover:text-phosphor-text select-none ${className}`}
    >
      {label} {sortKey === k ? (asc ? "▲" : "▼") : ""}
    </th>
  );

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 panel flex items-center gap-2 px-3 py-2 border-b">
        <span className="text-[10px] tracking-widest text-phosphor-muted">FILTER:</span>
        {(["ALL", "HOT", "WARM", "COLD"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 text-[10px] tracking-widest border ${
              filter === f
                ? "border-phosphor text-phosphor"
                : "border-terminal-border text-phosphor-muted hover:border-phosphor-dim"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-phosphor-muted">{rows.length} Leads</span>
      </div>

      <table className="w-full border-collapse">
        <thead className="panel">
          <tr className="border-b border-terminal-border">
            <Th k="name" label="NAME" />
            <th className="px-3 py-2 text-left text-[10px] tracking-widest text-phosphor-muted">
              BRANCHE
            </th>
            <Th k="final" label="SCORE" />
            <th className="px-3 py-2 text-left text-[10px] tracking-widest text-phosphor-muted">
              BEWERTUNG
            </th>
            <Th k="pay" label="ZK" />
            <Th k="need" label="BED" />
            <Th k="fit" label="FIT" />
            <Th k="reviewCount" label="REV" />
            <th className="px-3 py-2 text-left text-[10px] tracking-widest text-phosphor-muted">
              IG
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr
              key={l.id}
              onClick={() => onSelect(l)}
              className={`border-b border-terminal-border/50 cursor-pointer hover:bg-phosphor-dim/10 ${
                selectedId === l.id ? "bg-phosphor-dim/20" : ""
              }`}
            >
              <td className="px-3 py-1.5 text-xs text-phosphor-text max-w-[220px] truncate">
                {l.name}
              </td>
              <td className="px-3 py-1.5 text-[11px] text-phosphor-muted">{l.branchLabel}</td>
              <td className="px-3 py-1.5 text-xs font-bold tabular-nums text-phosphor">
                {l.score.final}
              </td>
              <td className="px-3 py-1.5">
                <RatingBadge rating={l.score.rating} />
              </td>
              <td className="px-3 py-1.5 text-[11px] tabular-nums text-phosphor-muted">
                {l.score.pay}
              </td>
              <td className="px-3 py-1.5 text-[11px] tabular-nums text-phosphor-muted">
                {l.score.need}
              </td>
              <td className="px-3 py-1.5 text-[11px] tabular-nums text-phosphor-muted">
                {l.score.fit}
              </td>
              <td className="px-3 py-1.5 text-[11px] tabular-nums text-phosphor-muted">
                {l.reviewCount ?? "–"}
              </td>
              <td className="px-3 py-1.5 text-[11px]">
                {typeof l.instagram === "string" ? (
                  <span className="text-phosphor">✓</span>
                ) : l.instagram === null ? (
                  <span className="text-phosphor-muted/50">–</span>
                ) : (
                  <span className="text-phosphor-muted/30">?</span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-phosphor-muted text-xs">
                Keine Leads. Erst einen Scan im MAP-Modus starten.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
