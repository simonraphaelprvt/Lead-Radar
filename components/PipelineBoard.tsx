"use client";

import { useState } from "react";
import type { Lead, PipelineStatus } from "@/lib/types";
import { PIPELINE_STATUSES, STATUS_COLORS } from "@/lib/constants";
import { EinstufungBadge } from "./Badges";

interface BoardProps {
  leads: Lead[];
  loading: boolean;
  error: string | null;
  onChangeStatus: (pageId: string, status: PipelineStatus) => void;
  onRefresh: () => void;
  onSelect: (lead: Lead) => void;
}

function Card({
  lead,
  onChangeStatus,
  onSelect,
}: {
  lead: Lead;
  onChangeStatus: (pageId: string, status: PipelineStatus) => void;
  onSelect: (lead: Lead) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/lead", lead.notionPageId ?? "")}
      className="panel rounded-md p-2.5 mb-2 cursor-grab active:cursor-grabbing hover:border-phosphor-dim transition-colors"
    >
      <div className="flex items-start justify-between gap-1">
        <button
          onClick={() => onSelect(lead)}
          className="text-left text-[13px] text-phosphor-text hover:text-phosphor truncate max-w-[150px]"
        >
          {lead.name}
        </button>
        <EinstufungBadge e={lead.einstufung} />
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-phosphor-muted">
        <span className="font-mono tabular-nums">{lead.finalScore}</span>
        {lead.phone && <span>☎</span>}
        {typeof lead.instagram === "string" && <span className="text-phosphor">IG</span>}
        <span className="truncate">{lead.categoryLabel}</span>
      </div>
      <select
        value={lead.status ?? "Neu"}
        onChange={(e) =>
          lead.notionPageId &&
          onChangeStatus(lead.notionPageId, e.target.value as PipelineStatus)
        }
        className="mt-2 w-full bg-black/40 border border-terminal-border text-[10px] text-phosphor-text px-1 py-0.5"
      >
        {PIPELINE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PipelineBoard(props: BoardProps) {
  const [dragOver, setDragOver] = useState<PipelineStatus | null>(null);

  const byStatus: Record<string, Lead[]> = {};
  for (const s of PIPELINE_STATUSES) byStatus[s] = [];
  for (const l of props.leads) {
    const s = l.status ?? "Neu";
    (byStatus[s] ??= []).push(l);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="panel flex items-center gap-3 px-3 py-2 border-b">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-phosphor-text">
          Vertriebs-Pipeline
        </span>
        <span className="text-[10px] text-phosphor-muted">
          {props.leads.length} Leads · Quelle: Notion
        </span>
        <button
          onClick={props.onRefresh}
          disabled={props.loading}
          className="ml-auto px-2 py-1 text-[10px] tracking-widest border border-terminal-border text-phosphor-muted hover:border-phosphor-dim hover:text-phosphor-text"
        >
          {props.loading ? "LADE ..." : "↻ AKTUALISIEREN"}
        </button>
      </div>

      {props.error && (
        <div className="px-3 py-2 text-[11px] text-status-hot/80 border-b border-terminal-border">
          ! Notion nicht erreichbar: {props.error}
        </div>
      )}

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-2 p-2 min-w-max">
          {PIPELINE_STATUSES.map((status) => (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver((d) => (d === status ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const pageId = e.dataTransfer.getData("text/lead");
                if (pageId) props.onChangeStatus(pageId, status);
              }}
              className={`w-[210px] shrink-0 flex flex-col border ${
                dragOver === status ? "border-phosphor" : "border-terminal-border"
              }`}
            >
              <div
                className="flex items-center justify-between px-2 py-1.5 border-b border-terminal-border"
                style={{ borderTop: `2px solid ${STATUS_COLORS[status]}` }}
              >
                <span className="text-[10px] tracking-widest" style={{ color: STATUS_COLORS[status] }}>
                  {status.toUpperCase()}
                </span>
                <span className="text-[10px] text-phosphor-muted tabular-nums">
                  {byStatus[status].length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5">
                {byStatus[status].map((l) => (
                  <Card
                    key={l.notionPageId}
                    lead={l}
                    onChangeStatus={props.onChangeStatus}
                    onSelect={props.onSelect}
                  />
                ))}
                {byStatus[status].length === 0 && (
                  <div className="text-[10px] text-phosphor-muted/40 text-center py-4">
                    leer
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
