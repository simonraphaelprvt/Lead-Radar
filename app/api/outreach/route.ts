// ====================================================================
// POST /api/outreach
// Erzeugt pro Lead: Content-Idee, Instagram-DM und E-Mail.
//   - KI-Modus (Standard, wenn ANTHROPIC_API_KEY gesetzt): ruft
//     claude-sonnet-4-6 ueber die Messages API (raw fetch).
//   - Template-Modus (Fallback): regelbasiert aus lib/outreach.
// Stilregeln werden im System-Prompt erzwungen und zusaetzlich
// nachgereinigt (keine Gedankenstriche).
// ====================================================================

import { NextResponse } from "next/server";
import {
  buildSystemPrompt,
  buildUserPrompt,
  sanitizeDashes,
  templateOutreach,
} from "@/lib/outreach";
import type { Lead, OutreachResult } from "@/lib/types";

export const runtime = "nodejs";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

interface ParsedOutreach {
  contentIdea: string;
  dm: string;
  email: string;
}

/** Holt das JSON-Objekt robust aus der Modell-Antwort (auch in Codeblocks). */
function parseOutreachJson(text: string): ParsedOutreach | null {
  try {
    let t = text.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) t = fence[1].trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(t.slice(start, end + 1)) as Partial<ParsedOutreach>;
    if (
      typeof obj.contentIdea === "string" &&
      typeof obj.dm === "string" &&
      typeof obj.email === "string"
    ) {
      return { contentIdea: obj.contentIdea, dm: obj.dm, email: obj.email };
    }
    return null;
  } catch {
    return null;
  }
}

async function generateWithAi(lead: Lead): Promise<OutreachResult | null> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(lead) }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text =
    data.content?.find((b) => b.type === "text" && b.text)?.text ?? "";
  const parsed = parseOutreachJson(text);
  if (!parsed) return null;

  return {
    mode: "ai",
    contentIdea: sanitizeDashes(parsed.contentIdea),
    dm: sanitizeDashes(parsed.dm),
    email: sanitizeDashes(parsed.email),
  };
}

export async function POST(req: Request) {
  let body: { lead?: Lead };
  try {
    body = (await req.json()) as { lead?: Lead };
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const lead = body.lead;
  if (!lead || !lead.name) {
    return NextResponse.json({ error: "lead mit Name erforderlich." }, { status: 400 });
  }

  // Ohne Key: Template-Modus.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(templateOutreach(lead));
  }

  // KI-Modus mit sauberem Fallback auf Template.
  try {
    const ai = await generateWithAi(lead);
    if (ai) return NextResponse.json(ai);
    // Parsing fehlgeschlagen -> Template.
    return NextResponse.json(templateOutreach(lead));
  } catch (e) {
    const fallback = templateOutreach(lead);
    return NextResponse.json({ ...fallback, warning: (e as Error).message });
  }
}
