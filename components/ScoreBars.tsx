"use client";

import type { LeadRating, LeadScore } from "@/lib/types";
import { RATING_COLORS } from "@/lib/constants";

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[10px] tracking-widest text-phosphor-muted mb-1">
        <span>{label}</span>
        <span className="text-phosphor-text tabular-nums">{value}</span>
      </div>
      <div className="h-2 bg-black/50 border border-terminal-border overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

export function RatingBadge({ rating, large = false }: { rating: LeadRating; large?: boolean }) {
  const color = RATING_COLORS[rating];
  return (
    <span
      className={`inline-flex items-center justify-center font-bold tracking-widest border ${
        large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[10px]"
      } ${rating === "HOT" ? "animate-pulse" : ""}`}
      style={{ color, borderColor: color, boxShadow: `0 0 8px ${color}55` }}
    >
      {rating}
    </span>
  );
}

export default function ScoreBars({ score }: { score: LeadScore }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] tracking-widest text-phosphor-muted">
          GESAMT-SCORE
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-phosphor glow-text tabular-nums">
            {score.final}
          </span>
          <RatingBadge rating={score.rating} large />
        </div>
      </div>
      <Bar label="ZAHLUNGSKRAFT" value={score.pay} color="#37c0ff" />
      <Bar label="BEDARF" value={score.need} color="#ffb000" />
      <Bar label="BRANCHEN-FIT" value={score.fit} color="#39ff8b" />
    </div>
  );
}
