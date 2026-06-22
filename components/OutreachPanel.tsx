"use client";

import { useState } from "react";
import type { Lead, OutreachResult } from "@/lib/types";
import CopyButton from "./CopyButton";

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-3 border border-terminal-border">
      <div className="flex items-center justify-between px-2 py-1 bg-black/30 border-b border-terminal-border">
        <span className="text-[10px] tracking-widest text-phosphor-muted">{title}</span>
        <CopyButton text={body} />
      </div>
      <pre className="px-2 py-2 text-[11px] leading-relaxed text-phosphor-text whitespace-pre-wrap font-mono">
        {body}
      </pre>
    </div>
  );
}

export default function OutreachPanel({ lead }: { lead: Lead }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<(OutreachResult & { warning?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler bei der Generierung.");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold tracking-wider uppercase text-phosphor-muted">Outreach</div>
        {result && (
          <span className="text-[9px] tracking-widest text-phosphor-muted border border-terminal-border px-1.5 py-0.5">
            {result.mode === "ai" ? "KI-MODUS" : "TEMPLATE"}
          </span>
        )}
      </div>

      {!result && (
        <button
          onClick={generate}
          disabled={loading}
          className="w-full py-2 text-xs tracking-[0.2em] font-bold border border-phosphor text-phosphor hover:bg-phosphor-dim/25 disabled:opacity-40 transition-colors"
        >
          {loading ? "Generiere …" : "Outreach erstellen"}
        </button>
      )}

      {error && <div className="mt-2 text-[10px] text-status-hot/80">! {error}</div>}

      {result && (
        <div>
          {result.warning && (
            <div className="mb-2 text-[10px] text-status-warm/80">
              Hinweis: KI nicht verfügbar, Template genutzt. ({result.warning})
            </div>
          )}
          <Block title="CONTENT-IDEE (AUFHÄNGER)" body={result.contentIdea} />
          <Block title="INSTAGRAM-DM" body={result.dm} />
          <Block title="E-MAIL" body={result.email} />
          <button
            onClick={generate}
            disabled={loading}
            className="w-full py-1.5 text-[10px] tracking-widest border border-terminal-border text-phosphor-muted hover:border-phosphor-dim hover:text-phosphor-text"
          >
            {loading ? "..." : "↻ NEU GENERIEREN"}
          </button>
        </div>
      )}
    </div>
  );
}
