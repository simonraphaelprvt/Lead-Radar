"use client";

import type { Lead } from "@/lib/types";
import ScoreBars from "./ScoreBars";
import OutreachPanel from "./OutreachPanel";
import CopyButton from "./CopyButton";
import { leadToMarkdown } from "@/lib/exporters";

interface DrawerProps {
  lead: Lead;
  onClose: () => void;
  onAddToPipeline: (lead: Lead) => void;
  onEnrich: (lead: Lead) => void;
  onToggleIndeed: (lead: Lead) => void;
  enriching: boolean;
  addingToPipeline: boolean;
  pipelineError: string | null;
}

function ContactRow({
  label,
  children,
  highlight = false,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border ${
        highlight ? "border-phosphor/40 bg-phosphor-dim/10" : "border-terminal-border"
      }`}
    >
      <span className="text-[9px] tracking-widest text-phosphor-muted w-16 shrink-0">
        {label}
      </span>
      <div className="flex-1 min-w-0 text-sm text-phosphor-text truncate">{children}</div>
    </div>
  );
}

export default function LeadDrawer(props: DrawerProps) {
  const { lead } = props;
  const inPipeline = !!lead.notionPageId;

  return (
    <div className="fixed inset-y-0 right-0 z-30 w-[min(440px,92vw)] panel border-l flex flex-col shadow-2xl">
      {/* Kopf */}
      <div className="flex items-start justify-between gap-2 p-3 border-b border-terminal-border">
        <div className="min-w-0">
          <div className="text-base font-bold text-phosphor glow-text truncate">{lead.name}</div>
          <div className="text-[10px] tracking-widest text-phosphor-muted">
            {lead.branchLabel}
            {lead.primaryTypeDisplay ? ` · ${lead.primaryTypeDisplay}` : ""}
          </div>
        </div>
        <button
          onClick={props.onClose}
          className="px-2 py-1 text-phosphor-muted hover:text-phosphor-text border border-terminal-border"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* TOP: Instagram + Telefon hervorgehoben */}
        <div className="space-y-2">
          <ContactRow label="INSTAGRAM" highlight>
            {typeof lead.instagram === "string" ? (
              <a
                href={lead.instagram}
                target="_blank"
                rel="noreferrer"
                className="text-phosphor hover:underline"
              >
                {lead.instagram.replace("https://instagram.com/", "@")}
              </a>
            ) : lead.instagram === null ? (
              <span className="text-phosphor-muted">nicht gefunden</span>
            ) : (
              <button
                onClick={() => props.onEnrich(lead)}
                disabled={props.enriching || !lead.website}
                className="text-[11px] tracking-widest text-amber border border-amber-dim px-2 py-0.5 hover:bg-amber/10 disabled:opacity-40"
              >
                {props.enriching ? "SUCHE ..." : lead.website ? "⊕ ANREICHERN" : "keine Website"}
              </button>
            )}
          </ContactRow>

          <ContactRow label="TELEFON" highlight>
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className="text-phosphor hover:underline">
                {lead.phone}
              </a>
            ) : (
              <span className="text-phosphor-muted">nicht vorhanden</span>
            )}
          </ContactRow>
        </div>

        {/* Scores */}
        <div className="panel p-3 border">
          <ScoreBars score={lead.score} />
          <label className="mt-3 flex items-center gap-2 text-[10px] tracking-widest text-phosphor-muted cursor-pointer">
            <input
              type="checkbox"
              checked={!!lead.indeedFlag}
              onChange={() => props.onToggleIndeed(lead)}
              className="accent-[#ffb000]"
            />
            SUCHT AKTIV SOCIAL-MEDIA-PERSONAL (manuell, hebt Bedarf)
          </label>
        </div>

        {/* Restliche Daten */}
        <div className="space-y-1.5 text-xs">
          <ContactRow label="ADRESSE">{lead.address || "–"}</ContactRow>
          <ContactRow label="WEBSITE">
            {lead.website ? (
              <a
                href={lead.website}
                target="_blank"
                rel="noreferrer"
                className="text-phosphor-text hover:underline"
              >
                {lead.website.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <span className="text-phosphor-muted">keine</span>
            )}
          </ContactRow>
          <ContactRow label="GOOGLE">
            {typeof lead.rating === "number"
              ? `${lead.rating} ★ · ${lead.reviewCount ?? 0} Bewertungen`
              : "–"}
            {lead.googleMapsUri && (
              <a
                href={lead.googleMapsUri}
                target="_blank"
                rel="noreferrer"
                className="ml-2 text-phosphor hover:underline"
              >
                Maps ↗
              </a>
            )}
          </ContactRow>
          {lead.openingHours && lead.openingHours.length > 0 && (
            <details className="border border-terminal-border px-3 py-2">
              <summary className="text-[9px] tracking-widest text-phosphor-muted cursor-pointer">
                ÖFFNUNGSZEITEN
              </summary>
              <div className="mt-1 text-[11px] text-phosphor-text/80 space-y-0.5">
                {lead.openingHours.map((h, i) => (
                  <div key={i}>{h}</div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Outreach */}
        <div className="panel p-3 border">
          <OutreachPanel lead={lead} />
        </div>
      </div>

      {/* Aktions-Leiste */}
      <div className="p-3 border-t border-terminal-border space-y-2">
        {props.pipelineError && (
          <div className="text-[10px] text-status-hot/80">! {props.pipelineError}</div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => props.onAddToPipeline(lead)}
            disabled={props.addingToPipeline || inPipeline}
            className={`flex-1 py-2 text-[11px] tracking-widest font-bold border transition-colors ${
              inPipeline
                ? "border-phosphor-dim text-phosphor-dim"
                : "border-phosphor text-phosphor hover:bg-phosphor-dim/25"
            } disabled:opacity-60`}
          >
            {inPipeline
              ? "✓ IN PIPELINE"
              : props.addingToPipeline
                ? "ÜBERTRAGE ..."
                : "▶ IN PIPELINE"}
          </button>
          <CopyButton
            text={leadToMarkdown(lead)}
            label="⤓ MARKDOWN"
            className="flex-1 justify-center"
          />
        </div>
      </div>
    </div>
  );
}
