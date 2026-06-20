// ====================================================================
// Export-Helfer: CSV (alle/gefilterte Leads) und Markdown (atomare Notiz).
// Reine Funktionen, im Client nutzbar.
// ====================================================================

import type { Lead } from "./types";

const CSV_COLUMNS: { key: string; label: string; get: (l: Lead) => string }[] = [
  { key: "name", label: "Name", get: (l) => l.name },
  { key: "rating", label: "Bewertung", get: (l) => l.score.rating },
  { key: "score", label: "Score", get: (l) => String(l.score.final) },
  { key: "pay", label: "Zahlungskraft", get: (l) => String(l.score.pay) },
  { key: "need", label: "Bedarf", get: (l) => String(l.score.need) },
  { key: "fit", label: "Fit", get: (l) => String(l.score.fit) },
  { key: "branch", label: "Branche", get: (l) => l.branchLabel },
  { key: "phone", label: "Telefon", get: (l) => l.phone ?? "" },
  {
    key: "instagram",
    label: "Instagram",
    get: (l) => (typeof l.instagram === "string" ? l.instagram : ""),
  },
  { key: "website", label: "Website", get: (l) => l.website ?? "" },
  { key: "address", label: "Adresse", get: (l) => l.address },
  { key: "reviews", label: "Anzahl Bewertungen", get: (l) => String(l.reviewCount ?? "") },
  { key: "maps", label: "Google Maps", get: (l) => l.googleMapsUri ?? "" },
];

function csvCell(value: string): string {
  // RFC-4180: bei Komma, Anfuehrungszeichen oder Zeilenumbruch quoten.
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function leadsToCsv(leads: Lead[]): string {
  const header = CSV_COLUMNS.map((c) => c.label).join(",");
  const rows = leads.map((l) =>
    CSV_COLUMNS.map((c) => csvCell(c.get(l))).join(","),
  );
  // BOM voranstellen, damit Excel die Umlaute korrekt liest.
  return "﻿" + [header, ...rows].join("\r\n");
}

/** Atomare Notiz mit Frontmatter, passend fuer einen Obsidian-Vault. */
export function leadToMarkdown(lead: Lead): string {
  const today = new Date().toISOString().slice(0, 10);
  const ig = typeof lead.instagram === "string" ? lead.instagram : "nicht gefunden";
  const fm = [
    "---",
    `name: ${quoteYaml(lead.name)}`,
    `branche: ${quoteYaml(lead.branchLabel)}`,
    `score: ${lead.score.final}`,
    `bewertung: ${lead.score.rating}`,
    `instagram: ${quoteYaml(ig)}`,
    `telefon: ${quoteYaml(lead.phone ?? "")}`,
    `quelle: Google Places`,
    `datum: ${today}`,
    "tags: [lead, akquise]",
    "---",
  ].join("\n");

  const body = [
    `# ${lead.name}`,
    "",
    `**Bewertung:** ${lead.score.rating}  (Score ${lead.score.final})`,
    `**Zahlungskraft:** ${lead.score.pay} | **Bedarf:** ${lead.score.need} | **Fit:** ${lead.score.fit}`,
    "",
    "## Kontakt",
    `- Instagram: ${ig}`,
    `- Telefon: ${lead.phone ?? "nicht vorhanden"}`,
    `- Website: ${lead.website ?? "keine"}`,
    `- Adresse: ${lead.address}`,
    lead.googleMapsUri ? `- Google Maps: ${lead.googleMapsUri}` : "",
    "",
    "## Daten",
    `- Branche: ${lead.branchLabel}`,
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
  if (/[:#\[\]{}",]/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
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
