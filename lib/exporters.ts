// ====================================================================
// Export-Helfer: CSV (alle/gefilterte Leads) und Markdown (atomare Notiz).
// Reine Funktionen, im Client nutzbar. Schema: Reasoning-Engine v2.
// ====================================================================

import type { Lead } from "./types";

const CSV_COLUMNS: { key: string; label: string; get: (l: Lead) => string }[] = [
  { key: "name", label: "Name", get: (l) => l.name },
  { key: "einstufung", label: "Einstufung", get: (l) => l.einstufung },
  { key: "tier", label: "Tier", get: (l) => l.tier },
  { key: "substanz", label: "Substanz", get: (l) => String(l.substanzScore) },
  { key: "painmatch", label: "Pain-Match", get: (l) => l.painMatch.level },
  { key: "kapital", label: "Kapital", get: (l) => String(l.painMatch.kapital_score) },
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
    `substanz: ${lead.substanzScore}`,
    `pain_match: ${lead.painMatch.level}`,
    `kapital: ${lead.painMatch.kapital_score}`,
    `empfehlung: ${lead.empfehlung}`,
    `instagram: ${quoteYaml(ig)}`,
    `telefon: ${quoteYaml(lead.phone ?? "")}`,
    `quelle: Google Places`,
    `datum: ${today}`,
    "tags: [lead, akquise]",
    "---",
  ].join("\n");

  const sub = lead.substanz;
  const body = [
    `# ${lead.name}`,
    "",
    `**${lead.einstufung}** · Tier ${lead.tier}${lead.tierCOnHold ? " (on hold)" : ""} · Substanz ${lead.substanzScore}/100 · Pain-Match ${lead.painMatch.level} (Kapital ${lead.painMatch.kapital_score})`,
    lead.koGrund ? `**KO:** ${lead.koGrund}` : "",
    lead.begruendungKurz ? `> ${lead.begruendungKurz}` : "",
    "",
    "## Scrapebare Bewertung",
    `- Finanzielle Substanz: ${sub.finanzielle.score} — ${sub.finanzielle.begruendung}`,
    `- Visuell darstellbar: ${sub.visuell.score} — ${sub.visuell.begruendung}`,
    `- Schmerzpunkt: ${sub.schmerz.score} — ${sub.schmerz.begruendung}`,
    "",
    "## Pain-Match (Kapital × Lösbarkeit)",
    `- Einstufung: ${lead.painMatch.level}`,
    `- ${lead.painMatch.begruendung}`,
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
