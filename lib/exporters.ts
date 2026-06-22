// ====================================================================
// Export-Helfer: CSV (alle/gefilterte Leads) und Markdown (atomare Notiz).
// Reine Funktionen, im Client nutzbar. Schema: Reasoning-Engine v2.
// ====================================================================

import type { Lead } from "./types";

const CSV_COLUMNS: { key: string; label: string; get: (l: Lead) => string }[] = [
  { key: "name", label: "Name", get: (l) => l.name },
  { key: "einstufung", label: "Einstufung", get: (l) => l.einstufung },
  { key: "final", label: "Final", get: (l) => String(l.finalScore) },
  { key: "pay", label: "Zahlungskraft", get: (l) => String(l.payScore) },
  { key: "need", label: "Bedarf", get: (l) => String(l.needScore) },
  { key: "fit", label: "Fit", get: (l) => String(l.fitScore) },
  { key: "pain", label: "Pain-Match", get: (l) => String(l.painMatchScore) },
  { key: "tier", label: "Tier", get: (l) => l.tier },
  { key: "empfehlung", label: "Empfehlung", get: (l) => l.empfehlung },
  { key: "ko", label: "KO-Grund", get: (l) => l.koGrund ?? "" },
  { key: "branch", label: "Branche", get: (l) => l.categoryLabel },
  { key: "rating", label: "Google-Rating", get: (l) => (l.rating != null ? String(l.rating) : "") },
  { key: "reviews", label: "Reviews", get: (l) => String(l.reviewCount ?? "") },
  { key: "phone", label: "Telefon", get: (l) => l.phone ?? "" },
  {
    key: "instagram",
    label: "Instagram",
    get: (l) => (typeof l.instagram === "string" ? l.instagram : ""),
  },
  { key: "website", label: "Website", get: (l) => l.website ?? "" },
  { key: "address", label: "Adresse", get: (l) => l.address },
  { key: "maps", label: "Google Maps", get: (l) => l.googleMapsUri ?? "" },
];

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function leadsToCsv(leads: Lead[]): string {
  const header = CSV_COLUMNS.map((c) => c.label).join(",");
  const rows = leads.map((l) => CSV_COLUMNS.map((c) => csvCell(c.get(l))).join(","));
  return "﻿" + [header, ...rows].join("\r\n");
}

/** Atomare Notiz mit Frontmatter, passend fuer einen Obsidian-Vault. */
export function leadToMarkdown(lead: Lead): string {
  const today = new Date().toISOString().slice(0, 10);
  const ig = typeof lead.instagram === "string" ? lead.instagram : "nicht gefunden";
  const fm = [
    "---",
    `name: ${quoteYaml(lead.name)}`,
    `branche: ${quoteYaml(lead.categoryLabel)}`,
    `einstufung: ${lead.einstufung}`,
    `tier: ${lead.tier}`,
    `final: ${lead.finalScore}`,
    `pay: ${lead.payScore}`,
    `need: ${lead.needScore}`,
    `fit: ${lead.fitScore}`,
    `pain_match: ${lead.painMatchScore}`,
    `empfehlung: ${lead.empfehlung}`,
    `instagram: ${quoteYaml(ig)}`,
    `telefon: ${quoteYaml(lead.phone ?? "")}`,
    `quelle: Google Places`,
    `datum: ${today}`,
    "tags: [lead, akquise]",
    "---",
  ].join("\n");

  const a = lead.achsen;
  const painLines = lead.painSignals.map((p) => {
    const mark = p.found ? "✓" : p.pruefbar ? "—" : "?";
    return `- ${mark} ${p.label} (${p.weight}): ${p.beleg}`;
  });
  const indikatorLabel = lead.einstufung.replace("_", " ");
  const body = [
    `# ${lead.name}`,
    "",
    `**${indikatorLabel}** · final ${lead.finalScore}/100 · pay ${lead.payScore} · need ${lead.needScore} · fit ${lead.fitScore} · pain ${lead.painMatchScore} · Tier ${lead.tier}${lead.tierCOnHold ? " (off-profile)" : ""}`,
    lead.koGrund ? `**KO:** ${lead.koGrund}` : "",
    lead.begruendungKurz ? `> ${lead.begruendungKurz}` : "",
    "",
    "## Rohachsen",
    `- Zahlungskraft (pay): ${a.pay.score} — ${a.pay.begruendung}`,
    `- Bedarf (need): ${a.need.score} — ${a.need.begruendung}`,
    `- Fit: ${a.fit.score} — ${a.fit.begruendung}`,
    "",
    "## Pain-Signale (einzeln belegt)",
    ...(painLines.length ? painLines : ["- keine"]),
    "",
    "## Im Erstkontakt pruefen (nicht scrapebar)",
    "- Konkreter Anlass / Phase (Launch, Event, Recruiting): unbekannt",
    "- Entscheider direkt erreichbar: unbekannt",
    "- Bereit, Gesicht zu zeigen: unbekannt",
    "- Langfristige Bindung: unbekannt",
    "- Keine Chaos-Signale: unbekannt",
    "",
    "## Kontakt",
    `- Instagram: ${ig}`,
    `- Telefon: ${lead.phone ?? "nicht vorhanden"}`,
    `- Website: ${lead.website ?? "keine"}`,
    `- Adresse: ${lead.address}`,
    lead.googleMapsUri ? `- Google Maps: ${lead.googleMapsUri}` : "",
    typeof lead.rating === "number"
      ? `- Google: ${lead.rating} Sterne bei ${lead.reviewCount ?? 0} Bewertungen`
      : "",
    "",
    "## Notizen",
    lead.notes ?? "",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return `${fm}\n\n${body}\n`;
}

function quoteYaml(value: string): string {
  if (value === "") return '""';
  if (/[:#[\]{}",]/.test(value)) return `"${value.replace(/"/g, '\\"')}"`;
  return value;
}

/** Loest im Browser einen Datei-Download aus. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
