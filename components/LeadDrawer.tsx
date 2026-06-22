"use client";

import { useEffect, useState } from "react";
import type { Lead, Teilscore } from "@/lib/types";
import { EINSTUFUNG_COLOR, PAIN_COLOR, EinstufungBadge, TierBadge, PainMatchBadge } from "./Badges";
import OutreachPanel from "./OutreachPanel";
import CopyButton from "./CopyButton";
import SatelliteThumb from "./SatelliteThumb";
import { leadToMarkdown } from "@/lib/exporters";

interface DrawerProps {
  lead: Lead;
  onClose: () => void;
  onAddToPipeline: (lead: Lead) => void;
  addingToPipeline: boolean;
  pipelineError: string | null;
  googleEnabled: boolean | null;
}

/** Bild-Hero mit Fallback-Kette: Google-Foto -> Website-Bild -> Karte. */
function Hero({ lead, googleEnabled }: { lead: Lead; googleEnabled: boolean | null }) {
  const candidates = [lead.photoUrl, lead.imageUrl].filter(
    (x): x is string => typeof x === "string",
  );
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [lead.id]);
  const c = EINSTUFUNG_COLOR[lead.einstufung];
  const loading = lead.photoUrl === undefined && googleEnabled !== false;
  const src = candidates[idx];

  return (
    <div className="relative" style={{ height: 160 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={lead.name}
          className="h-full w-full bg-terminal-panel-2 object-cover"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : loading ? (
        <div className="grid h-full w-full place-items-center bg-terminal-panel-2 text-[10px] tracking-wide text-phosphor-muted">
          Standort lädt …
        </div>
      ) : (
        <SatelliteThumb lat={lead.lat} lng={lead.lng} markerColor={c} height={160} />
      )}
      <div className="absolute left-3 top-3 flex items-center gap-1.5">
        <EinstufungBadge e={lead.einstufung} />
        <TierBadge t={lead.tier} onHold={lead.tierCOnHold} />
        {lead.einstufung !== "RAUS" && <PainMatchBadge p={lead.painMatch.level} />}
      </div>
    </div>
  );
}

/** Eine Substanz-Achse mit dünnem Balken + treibenden Signalen. */
function AxisBar({ label, score, ts }: { label: string; score: number; ts: Teilscore }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-phosphor-muted">{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-phosphor-text">{score}</span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded bg-terminal-panel-2">
        <div className="h-full rounded bg-phosphor" style={{ width: `${score}%` }} />
      </div>
      {ts.signale.length > 0 && (
        <div className="mt-1 text-[10px] leading-snug text-phosphor-dimtext">
          {ts.signale.join(" · ")}
        </div>
      )}
    </div>
  );
}

function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-terminal-border px-3 py-2">
      <span className="w-16 shrink-0 text-[9px] uppercase tracking-wide text-phosphor-muted">
        {label}
      </span>
      <div className="min-w-0 flex-1 truncate text-[13px] text-phosphor-text">{children}</div>
    </div>
  );
}

const CHECKLIST: { key: string; label: string }[] = [
  { key: "anlass", label: "Konkreter Anlass / Phase (Launch, Event, Recruiting)" },
  { key: "entscheider", label: "Entscheider direkt erreichbar" },
  { key: "gesicht", label: "Bereit, Gesicht zu zeigen" },
  { key: "langfristig", label: "Bereitschaft zu langfristiger Bindung" },
  { key: "chaos", label: "Keine Chaos-Signale" },
];

export default function LeadDrawer(props: DrawerProps) {
  const { lead } = props;
  const inPipeline = !!lead.notionPageId;
  const raus = lead.einstufung === "RAUS";
  const mapsQuery = encodeURIComponent(`${lead.name} ${lead.address ?? ""}`.trim());
  const streetView = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lead.lat},${lead.lng}`;
  const phoneSearch = `https://www.google.com/search?q=${mapsQuery}+telefon`;

  return (
    <div className="fixed inset-y-0 right-0 z-30 flex w-[min(440px,92vw)] flex-col overflow-hidden rounded-l-xl panel border-l shadow-2xl">
      <button
        onClick={props.onClose}
        aria-label="Schliessen"
        className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-black/40 text-phosphor-muted backdrop-blur hover:text-phosphor-text"
      >
        ✕
      </button>

      <div className="flex-1 overflow-y-auto">
        <Hero lead={lead} googleEnabled={props.googleEnabled} />

        {/* Name + Quick-Links */}
        <div className="border-b border-terminal-border p-4">
          <div className="truncate text-[17px] font-semibold text-phosphor-text">{lead.name}</div>
          <div className="mt-0.5 text-[11px] text-phosphor-muted">
            {lead.categoryLabel}
            {lead.rating != null && (
              <span className="font-mono"> · {lead.rating.toFixed(1)}★ · {lead.reviewCount ?? 0} Reviews</span>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <a href={streetView} target="_blank" rel="noreferrer" className="rounded-md border border-terminal-border px-2 py-1 text-[10px] tracking-wide text-phosphor-muted hover:text-phosphor-text">
              Street View ↗
            </a>
            <a href={lead.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer" className="rounded-md border border-terminal-border px-2 py-1 text-[10px] tracking-wide text-phosphor-muted hover:text-phosphor-text">
              Google Maps ↗
            </a>
          </div>
        </div>

        <div className="space-y-5 p-4">
          {/* Bewertung: entweder KO-Grund oder Substanz */}
          {raus ? (
            <div className="rounded-lg border p-3" style={{ borderColor: `${EINSTUFUNG_COLOR.RAUS}66` }}>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-phosphor-muted">
                Ausgeschlossen (KO)
              </div>
              <div className="text-[13px] text-phosphor-text">{lead.koGrund}</div>
            </div>
          ) : (
            <div className="panel rounded-lg border p-3.5">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-wide text-phosphor-muted">
                  Substanz (scrapebar)
                </span>
                <span className="font-mono text-[20px] font-semibold tabular-nums text-phosphor-text">
                  {lead.substanzScore}
                  <span className="text-[12px] text-phosphor-muted">/100</span>
                </span>
              </div>
              <div className="space-y-3">
                <AxisBar label="Finanzielle Substanz" score={lead.substanz.finanzielle.score} ts={lead.substanz.finanzielle} />
                <AxisBar label="Visuell darstellbar" score={lead.substanz.visuell.score} ts={lead.substanz.visuell} />
                <AxisBar label="Schmerzpunkt (schwach)" score={lead.substanz.schmerz.score} ts={lead.substanz.schmerz} />
              </div>
            </div>
          )}

          {/* Pain-Match: Kapital x Loesbarkeit (zweite Achse) */}
          {!raus && (
            <div className="panel rounded-lg border p-3.5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-phosphor-muted">
                  Pain-Match (Kapital × Lösbarkeit)
                </span>
                <PainMatchBadge p={lead.painMatch.level} />
              </div>

              {/* Kapital-Achse (Kern) */}
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-phosphor-muted">Kapitaleinschätzung</span>
                  <span className="font-mono text-[12px] tabular-nums text-phosphor-text">
                    {lead.painMatch.kapital_score}
                  </span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded bg-terminal-panel-2">
                  <div
                    className="h-full rounded"
                    style={{ width: `${lead.painMatch.kapital_score}%`, background: PAIN_COLOR[lead.painMatch.level] }}
                  />
                </div>
                {lead.painMatch.kapital_signale.length > 0 && (
                  <div className="mt-1 text-[10px] leading-snug text-phosphor-dimtext">
                    {lead.painMatch.kapital_signale.join(" · ")}
                  </div>
                )}
              </div>

              {/* Loesbarkeit + Anlass-Hinweis */}
              <div className="mt-3 flex items-center gap-2 text-[11px]">
                <span className={lead.painMatch.loesbar ? "text-phosphor-text" : "text-phosphor-muted"}>
                  {lead.painMatch.loesbar ? "✓ durch Content lösbar" : "○ kaum durch Content lösbar"}
                </span>
              </div>
              <div className="mt-2 rounded-md border border-terminal-border px-2.5 py-1.5 text-[10px] leading-snug text-phosphor-dimtext">
                Konkreter Anlass (Launch / Event / Recruiting) & Phase vs. Einzelevent sind nicht aus
                Scan-Daten ableitbar → im Erstkontakt prüfen.
              </div>
            </div>
          )}

          {/* Im Erstkontakt pruefen */}
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wide text-phosphor-muted">
              Im Erstkontakt prüfen (nicht messbar)
            </div>
            <div className="space-y-1.5">
              {CHECKLIST.map((c) => (
                <div key={c.key} className="flex items-center gap-2 text-[12px]">
                  <span className="grid h-4 w-4 place-items-center rounded border border-terminal-border text-[9px] text-phosphor-dimtext">
                    ?
                  </span>
                  <span className="text-phosphor-muted">{c.label}</span>
                  <span className="ml-auto font-mono text-[10px] text-phosphor-dimtext">unbekannt</span>
                </div>
              ))}
            </div>
          </div>

          {/* Kontakt */}
          <div className="space-y-1.5">
            <ContactRow label="Telefon">
              {lead.phone ? (
                <a href={`tel:${lead.phone}`} className="text-phosphor hover:underline">{lead.phone}</a>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-phosphor-muted">nicht vorhanden</span>
                  <a href={phoneSearch} target="_blank" rel="noreferrer" className="text-[11px] text-phosphor hover:underline">googeln ↗</a>
                </span>
              )}
            </ContactRow>
            <ContactRow label="Instagram">
              {typeof lead.instagram === "string" ? (
                <a href={lead.instagram} target="_blank" rel="noreferrer" className="text-phosphor hover:underline">
                  {lead.instagram.replace("https://instagram.com/", "@")}
                </a>
              ) : (
                <a href={`https://www.google.com/search?q=${mapsQuery}+instagram`} target="_blank" rel="noreferrer" className="text-[11px] text-phosphor hover:underline">
                  suchen ↗
                </a>
              )}
            </ContactRow>
            <ContactRow label="Website">
              {lead.website ? (
                <a href={lead.website} target="_blank" rel="noreferrer" className="text-phosphor-text hover:underline">
                  {lead.website.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                <span className="text-phosphor-muted">keine</span>
              )}
            </ContactRow>
            <ContactRow label="Adresse">{lead.address || "–"}</ContactRow>
            {lead.openingHours && lead.openingHours.length > 0 && (
              <details className="rounded-md border border-terminal-border px-3 py-2">
                <summary className="cursor-pointer text-[9px] uppercase tracking-wide text-phosphor-muted">
                  Öffnungszeiten
                </summary>
                <div className="mt-1 space-y-0.5 text-[11px] text-phosphor-text/80">
                  {lead.openingHours.map((h, i) => <div key={i}>{h}</div>)}
                </div>
              </details>
            )}
          </div>

          {/* Outreach */}
          {!raus && (
            <div className="panel rounded-lg border p-3.5">
              <OutreachPanel lead={lead} />
            </div>
          )}
        </div>
      </div>

      {/* Aktions-Leiste */}
      <div className="space-y-2 border-t border-terminal-border p-3">
        {props.pipelineError && (
          <div className="text-[10px] text-status-hot/80">! {props.pipelineError}</div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => props.onAddToPipeline(lead)}
            disabled={props.addingToPipeline || inPipeline}
            className={`flex-1 rounded-md py-2 text-[12px] font-medium tracking-wide transition-colors ${
              inPipeline
                ? "border border-terminal-border text-phosphor-muted"
                : "bg-phosphor text-white hover:brightness-110"
            } disabled:opacity-60`}
          >
            {inPipeline ? "✓ in Pipeline" : props.addingToPipeline ? "Übertrage …" : "In Pipeline"}
          </button>
          <CopyButton text={leadToMarkdown(lead)} label="↓ Markdown" className="flex-1 justify-center rounded-md" />
        </div>
      </div>
    </div>
  );
}
