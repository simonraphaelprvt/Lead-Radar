// ====================================================================
// Notion API - serverseitiger Client (Pipeline-Datenbank)
// --------------------------------------------------------------------
// Notion ist die einzige Quelle der Wahrheit fuer Leads.
// Roh-Fetch gegen die stabile API-Version, keine extra Dependency.
// Property-Namen kommen zentral aus constants.ts (NOTION_PROPS).
// ====================================================================

import { NOTION_PROPS } from "./constants";
import type { Lead, Einstufung, Empfehlung, PipelineStatus } from "./types";

const NOTION_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function headers() {
  const token = process.env.NOTION_API_KEY;
  if (!token) throw new Error("NOTION_API_KEY ist nicht gesetzt.");
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function databaseId(): string {
  const id = process.env.NOTION_LEADS_DATABASE_ID;
  if (!id) throw new Error("NOTION_LEADS_DATABASE_ID ist nicht gesetzt.");
  return id;
}

// ---- Hilfsfunktionen zum Bauen von Property-Werten ----
const P = NOTION_PROPS;

function title(text: string) {
  return { title: [{ text: { content: text.slice(0, 2000) } }] };
}
function richText(text?: string) {
  return { rich_text: text ? [{ text: { content: text.slice(0, 2000) } }] : [] };
}
function num(n?: number) {
  return { number: typeof n === "number" && !Number.isNaN(n) ? n : null };
}
function select(name?: string) {
  return { select: name ? { name } : null };
}
function url(u?: string | null) {
  return { url: u || null };
}
function phone(p?: string) {
  return { phone_number: p || null };
}
function date(iso: string) {
  return { date: { start: iso } };
}

/** Baut das Notion-Properties-Objekt aus einem Lead. */
export function leadToProperties(lead: Lead): Record<string, unknown> {
  return {
    [P.name]: title(lead.name),
    [P.status]: select(lead.status ?? "Neu"),
    // Bewertung = Einstufung, Score = Substanz. Die Legacy-Zahlenspalten
    // (Zahlungskraft/Bedarf/Fit) tragen jetzt die drei Substanz-Teilscores.
    [P.rating]: select(lead.einstufung),
    [P.score]: num(lead.substanzScore),
    [P.pay]: num(lead.substanz.finanzielle.score),
    [P.need]: num(lead.substanz.schmerz.score),
    [P.fit]: num(lead.substanz.visuell.score),
    [P.branch]: richText(lead.categoryLabel),
    [P.instagram]: url(typeof lead.instagram === "string" ? lead.instagram : null),
    [P.phone]: phone(lead.phone),
    [P.website]: url(lead.website ?? null),
    [P.address]: richText(lead.address),
    [P.googleMaps]: url(lead.googleMapsUri ?? null),
    [P.reviewCount]: num(lead.reviewCount ?? undefined),
    [P.notes]: richText(lead.notes),
    [P.addedAt]: date(lead.addedAt ?? new Date().toISOString()),
  };
}

/** Lead in die Datenbank schreiben. Liefert die Notion Page ID. */
export async function createLeadPage(lead: Lead): Promise<string> {
  const res = await fetch(`${NOTION_BASE}/pages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      parent: { database_id: databaseId() },
      properties: leadToProperties(lead),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Notion create ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

// ---- Lesen ----
type NotionPage = {
  id: string;
  properties: Record<string, any>;
};

function readText(prop: any): string {
  if (!prop) return "";
  if (prop.type === "title") return (prop.title ?? []).map((t: any) => t.plain_text).join("");
  if (prop.type === "rich_text") return (prop.rich_text ?? []).map((t: any) => t.plain_text).join("");
  return "";
}
function readNumber(prop: any): number | undefined {
  return prop?.number ?? undefined;
}
function readSelect(prop: any): string | undefined {
  return prop?.select?.name ?? undefined;
}
function readUrl(prop: any): string | undefined {
  return prop?.url ?? undefined;
}
function readPhone(prop: any): string | undefined {
  return prop?.phone_number ?? undefined;
}

/** Eine Notion-Page in ein (Teil-)Lead-Objekt fuer das Pipeline-Board uebersetzen. */
export function pageToLead(page: NotionPage): Lead {
  const props = page.properties;
  const einstufung = (readSelect(props[P.rating]) as Einstufung) ?? "COLD";
  const status = (readSelect(props[P.status]) as PipelineStatus) ?? "Neu";
  const fin = readNumber(props[P.pay]) ?? 0;
  const schmerz = readNumber(props[P.need]) ?? 0;
  const vis = readNumber(props[P.fit]) ?? 0;
  const empfehlung: Empfehlung =
    einstufung === "RAUS" ? "raus" : einstufung === "COLD" ? "spaeter" : "kontaktieren";
  const leer = { signale: [] as string[], begruendung: "" };
  return {
    id: page.id,
    notionPageId: page.id,
    name: readText(props[P.name]) || "(ohne Namen)",
    address: readText(props[P.address]),
    lat: 0,
    lng: 0,
    website: readUrl(props[P.website]),
    phone: readPhone(props[P.phone]),
    googleMapsUri: readUrl(props[P.googleMaps]),
    imageUrl: undefined,
    photoUrl: undefined,
    instagram: readUrl(props[P.instagram]) ?? undefined,
    categoryLabel: readText(props[P.branch]),
    rating: null,
    reviewCount: readNumber(props[P.reviewCount]) ?? null,
    priceLevel: null,
    photoCount: null,
    types: [],
    einstufung,
    tier: "B",
    tierCOnHold: false,
    substanzScore: readNumber(props[P.score]) ?? 0,
    // Pain-Match wird nicht in Notion gespeichert (Scan-Qualifier, kein Pipeline-Feld).
    painMatch: {
      level: "niedrig",
      kapital_score: 0,
      kapital_signale: [],
      loesbar: vis >= 45,
      anlass_status: "unbekannt",
      begruendung: "aus Pipeline geladen - Pain-Match nicht gespeichert",
    },
    koAusgeschlossen: einstufung === "RAUS",
    koGrund: null,
    empfehlung,
    begruendungKurz: "",
    substanz: {
      finanzielle: { score: fin, ...leer },
      visuell: { score: vis, ...leer },
      schmerz: { score: schmerz, ...leer },
    },
    erstkontakt: {
      entscheider_erreichbar: "unbekannt",
      gesicht_zeigen: "unbekannt",
      langfristig: "unbekannt",
      chaos_signale: "unbekannt",
    },
    status,
    notes: readText(props[P.notes]),
  };
}

/** Alle Leads aus der Pipeline lesen (paginiert). */
export async function queryLeads(): Promise<Lead[]> {
  const leads: Lead[] = [];
  let cursor: string | undefined = undefined;

  do {
    const res: Response = await fetch(
      `${NOTION_BASE}/databases/${databaseId()}/query`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          page_size: 100,
          start_cursor: cursor,
          sorts: [{ property: P.addedAt, direction: "descending" }],
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Notion query ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      results: NotionPage[];
      has_more: boolean;
      next_cursor: string | null;
    };
    for (const page of data.results) leads.push(pageToLead(page));
    cursor = data.has_more ? data.next_cursor ?? undefined : undefined;
  } while (cursor);

  return leads;
}

/** Status (und optional Notizen) eines Leads zurueckschreiben. */
export async function updateLead(
  pageId: string,
  fields: { status?: PipelineStatus; notes?: string },
): Promise<void> {
  const properties: Record<string, unknown> = {};
  if (fields.status) properties[P.status] = select(fields.status);
  if (typeof fields.notes === "string") properties[P.notes] = richText(fields.notes);

  const res = await fetch(`${NOTION_BASE}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Notion update ${res.status}: ${text.slice(0, 300)}`);
  }
}
