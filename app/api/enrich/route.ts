// ====================================================================
// POST /api/enrich
// Holt serverseitig die Firmen-Website(s) und extrahiert den Instagram-
// Handle. On demand oder als gedeckelte Batch. Fehler pro Lead werden
// gefangen, der Rest laeuft weiter.
//
// Body: { items: { id: string; website: string }[] }
// Antwort: { results: { id: string; instagram: string | null }[] }
// instagram === null bedeutet ehrlich "nicht gefunden".
// ====================================================================

import { NextResponse } from "next/server";
import { enrichInstagram } from "@/lib/instagram";
import { APP_CONFIG } from "@/lib/constants";

export const runtime = "nodejs";

interface EnrichItem {
  id: string;
  website: string;
}

export async function POST(req: Request) {
  let body: { items?: EnrichItem[] };
  try {
    body = (await req.json()) as { items?: EnrichItem[] };
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const items = (body.items ?? []).filter((i) => i && i.id && i.website);
  if (items.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // Deckel gegen Last auf den Ziel-Servern.
  const batch = items.slice(0, APP_CONFIG.ENRICH_BATCH_MAX);

  const results = await Promise.all(
    batch.map(async (item) => {
      try {
        const instagram = await enrichInstagram(item.website);
        return { id: item.id, instagram };
      } catch {
        return { id: item.id, instagram: null as string | null };
      }
    }),
  );

  return NextResponse.json({ results });
}
