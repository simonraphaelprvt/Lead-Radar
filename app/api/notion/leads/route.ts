// ====================================================================
// /api/notion/leads
//   GET   -> Pipeline lesen (alle Leads aus Notion)
//   POST  -> Lead in die Datenbank schreiben  { lead: Lead }
//   PATCH -> Status/Notizen zurueckschreiben   { pageId, status?, notes? }
// Sauberes Fehlerhandling: Notion-Probleme werden als JSON-Fehler
// gemeldet, nie still verschluckt.
// ====================================================================

import { NextResponse } from "next/server";
import { createLeadPage, queryLeads, updateLead } from "@/lib/notion";
import type { Lead, PipelineStatus } from "@/lib/types";

export const runtime = "nodejs";

function notionConfigured(): string | null {
  if (!process.env.NOTION_API_KEY) return "NOTION_API_KEY ist nicht gesetzt.";
  if (!process.env.NOTION_LEADS_DATABASE_ID)
    return "NOTION_LEADS_DATABASE_ID ist nicht gesetzt.";
  return null;
}

export async function GET() {
  const missing = notionConfigured();
  if (missing) return NextResponse.json({ error: missing }, { status: 500 });

  try {
    const leads = await queryLeads();
    return NextResponse.json({ leads });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const missing = notionConfigured();
  if (missing) return NextResponse.json({ error: missing }, { status: 500 });

  let body: { lead?: Lead };
  try {
    body = (await req.json()) as { lead?: Lead };
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  if (!body.lead || !body.lead.name) {
    return NextResponse.json({ error: "lead mit Name erforderlich." }, { status: 400 });
  }

  try {
    const lead: Lead = {
      ...body.lead,
      status: body.lead.status ?? "Neu",
      addedAt: body.lead.addedAt ?? new Date().toISOString(),
    };
    const pageId = await createLeadPage(lead);
    return NextResponse.json({ pageId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const missing = notionConfigured();
  if (missing) return NextResponse.json({ error: missing }, { status: 500 });

  let body: { pageId?: string; status?: PipelineStatus; notes?: string };
  try {
    body = (await req.json()) as {
      pageId?: string;
      status?: PipelineStatus;
      notes?: string;
    };
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  if (!body.pageId) {
    return NextResponse.json({ error: "pageId erforderlich." }, { status: 400 });
  }

  try {
    await updateLead(body.pageId, { status: body.status, notes: body.notes });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
