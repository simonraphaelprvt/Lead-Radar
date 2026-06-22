// ====================================================================
// Outreach-Generierung
// --------------------------------------------------------------------
// Liefert pro Lead: eine konkrete Content-Idee (Herzstueck), eine
// Instagram-DM und eine E-Mail. Zwei Modi:
//   - KI-Modus (Route ruft Anthropic): Prompts hier definiert.
//   - Template-Modus (Fallback): regelbasiert, hier vollstaendig.
// Stilregel ueberall: NIEMALS Gedankenstriche.
// ====================================================================

import type { Lead, OutreachResult } from "./types";

/** Leitet aus categoryLabel/types einen Branchen-Schluessel fuer die Content-Idee ab. */
function categoryKey(lead: Lead): string {
  const hay = `${lead.categoryLabel} ${(lead.types ?? []).join(" ")}`.toLowerCase();
  if (/\bbar\b|club|nightclub/.test(hay)) return "bar";
  if (/auto|kfz|car_dealer/.test(hay)) return "autohaus";
  if (/fitness|gym/.test(hay)) return "fitness";
  if (/beauty|kosmetik|friseur|hair|spa/.test(hay)) return "beauty";
  if (/hotel|resort|event|location|lodging/.test(hay)) return "hotel";
  if (/immobilien|estate/.test(hay)) return "immobilien";
  if (/zahnarzt|dentist/.test(hay)) return "zahnarzt";
  if (/arzt|praxis|doctor/.test(hay)) return "arztpraxis";
  if (/anwalt|steuer|kanzlei|lawyer|\bbau\b/.test(hay)) return "anwalt";
  if (/restaurant|cafe|café|imbiss|baeck|bäck|food|gastro|sushi|grill/.test(hay)) return "restaurant";
  return "default";
}

const SIGNATUR = "Mit freundlichen Grüßen, Simon Raphael Moser";

/**
 * Entfernt Gedankenstriche (em/en/figure dash) und als Gedankenstrich
 * genutzte Bindestriche. In-Wort-Bindestriche (Social-Media) bleiben.
 */
export function sanitizeDashes(text: string): string {
  return text
    .replace(/\s*[‒–—―]\s*/g, ", ")
    .replace(/ - /g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ", ")
    .replace(/[ \t]{2,}/g, " ");
}

// ---- Content-Ideen pro Branche (Hook + 3-Punkt-Aufbau) ----
interface Idea {
  hook: string;
  steps: [string, string, string];
}

function ideaFor(lead: Lead): Idea {
  const n = lead.name;

  // Spezifisch nach Branche (aus categoryLabel/types abgeleitet), sonst generisch.
  switch (categoryKey(lead)) {
    case "restaurant":
    case "cafe":
    case "imbiss":
    case "baeckerei":
      return {
        hook: `Das Gericht, das bei ${n} am häufigsten nachbestellt wird`,
        steps: [
          "Nahaufnahme der Zubereitung in der Küche, roher Sound",
          "Der Moment des Anrichtens auf dem Teller",
          "Erste ehrliche Reaktion eines Gastes am Tisch",
        ],
      };
    case "bar":
    case "nightclub":
      return {
        hook: `Was um 23 Uhr bei ${n} wirklich losgeht`,
        steps: [
          "Aufbau und Soundcheck, leerer Raum vor dem Ansturm",
          "Erste Gäste, Licht geht an, Drinks werden gemixt",
          "Peak auf der Tanzfläche im Zeitraffer",
        ],
      };
    case "autohaus":
    case "autowerkstatt":
      return {
        hook: `Vom Hereinfahren bis zur Übergabe bei ${n} in 30 Sekunden`,
        steps: [
          "Fahrzeug rollt auf den Hof, kurzer Empfang",
          "Schnelle Schnitte durch Check und Aufbereitung",
          "Schlüsselübergabe mit zufriedenem Kunden",
        ],
      };
    case "fitness":
      return {
        hook: `Die eine Übung, die jeder Anfänger bei ${n} zuerst lernt`,
        steps: [
          "Trainer erklärt die Bewegung in einem Satz",
          "Häufigster Fehler direkt gegen die saubere Ausführung geschnitten",
          "Ein Mitglied zeigt seinen Fortschritt",
        ],
      };
    case "beauty":
    case "friseur":
      return {
        hook: "Before und After in 15 Sekunden",
        steps: [
          "Ausgangszustand und kurzes Gespräch zum Wunsch",
          "Schnelle Schnitte durch die Behandlung",
          "Die große Enthüllung im Spiegel",
        ],
      };
    case "hotel":
    case "eventlocation":
      return {
        hook: `Der erste Blick, den Gäste bei ${n} lieben`,
        steps: [
          "Ankunft und Empfang aus Gästeperspektive",
          "Rundgang durch Zimmer oder Location, ruhige Kamera",
          "Ein Detail, das in Erinnerung bleibt",
        ],
      };
    case "immobilien":
      return {
        hook: "Diese Wohnung war in 48 Stunden weg",
        steps: [
          "Kurzer Außen- und Eingangsblick",
          "Die Highlight-Räume schnell geschnitten",
          "Klarer Aufruf zum Besichtigungstermin",
        ],
      };
    case "zahnarzt":
    case "arztpraxis":
      return {
        hook: `Die Frage, die Patienten bei ${n} am häufigsten stellen`,
        steps: [
          "Patient stellt die Frage direkt in die Kamera",
          "Klare Antwort in einem einzigen Satz",
          "Ein praktischer Tipp für zuhause",
        ],
      };
    case "anwalt":
    case "steuerberater":
    case "bau":
      return {
        hook: "Ein Fehler, der die meisten richtig teuer zu stehen kommt",
        steps: [
          "Der häufige Irrtum als klare Aussage",
          "Die Richtigstellung in einem Satz",
          "Der konkrete nächste Schritt",
        ],
      };
    default:
      // Retail und Rest
      return {
        hook: `Das eine Teil, das diese Woche bei ${n} alle wollen`,
        steps: [
          "Schneller Schwenk durch den Laden",
          "Fokus auf das Produkt, sauberes Licht",
          "So bekommst du es, klarer Aufruf",
        ],
      };
  }
}

function ideaToText(idea: Idea): string {
  return [
    `Hook: ${idea.hook}`,
    "Aufbau:",
    `1. ${idea.steps[0]}`,
    `2. ${idea.steps[1]}`,
    `3. ${idea.steps[2]}`,
  ].join("\n");
}

/** Vollstaendiger Template-Modus (ohne KI). */
export function templateOutreach(lead: Lead): OutreachResult {
  const idea = ideaFor(lead);
  const contentIdea = ideaToText(idea);

  const hatInstagram = typeof lead.instagram === "string";
  const dm = sanitizeDashes(
    [
      `Hey ${lead.name}-Team,`,
      "",
      `mir ist euer Auftritt aufgefallen und ich hatte direkt eine Reel-Idee für euch: ${idea.hook}.`,
      "",
      "Kurz zu mir: ich bin Simon, ich produziere Social-Media-Content für lokale Betriebe wie euch. Wenn ihr wollt, schicke ich euch das komplette Konzept rüber.",
      "",
      "Sagt einfach kurz Bescheid, dann lege ich los.",
    ].join("\n"),
  );

  const email = sanitizeDashes(
    [
      `Betreff: Eine konkrete Content-Idee für ${lead.name}`,
      "",
      `Sehr geehrtes Team von ${lead.name},`,
      "",
      "ich habe mir Ihren Auftritt angesehen und eine konkrete Idee für ein Reel mitgebracht, das zu Ihnen passt.",
      "",
      `Idee: ${idea.hook}`,
      "So könnte es aufgebaut sein:",
      `1. ${idea.steps[0]}`,
      `2. ${idea.steps[1]}`,
      `3. ${idea.steps[2]}`,
      "",
      "Ich produziere Social-Media-Content für lokale Betriebe und kümmere mich um Konzept, Dreh und Schnitt, sodass für Sie kaum Aufwand entsteht.",
      "",
      "Zwei kurze Fragen:",
      hatInstagram
        ? "1. Betreuen Sie Ihren Instagram-Kanal aktuell selbst?"
        : "1. Sind Sie auf Instagram bereits aktiv oder bisher gar nicht?",
      "2. Wäre ein kurzes Gespräch in dieser oder nächster Woche für Sie möglich?",
      "",
      SIGNATUR,
    ].join("\n"),
  );

  return { mode: "template", contentIdea, dm, email };
}

// ====================================================================
// KI-Modus: Prompt-Bausteine
// ====================================================================

export function buildSystemPrompt(): string {
  return [
    "Du bist der persönliche Akquise-Texter von Simon Raphael Moser, einem selbstständigen Content-Strategen, der lokale Businesses als Social-Media-Retainer-Kunden gewinnt.",
    "",
    "Erzeuge für EIN Business drei Dinge und gib sie ausschließlich als JSON zurück, ohne Markdown, ohne Codeblock, ohne weiteren Text:",
    '{ "contentIdea": "...", "dm": "...", "email": "..." }',
    "",
    "contentIdea: eine konkrete, spezifische Reel- oder Short-Idee für genau dieses Business. Beginne mit einer Zeile 'Hook: ...', danach 'Aufbau:' und drei nummerierte Punkte. Das ist das Herzstück und muss dem Empfänger sofort Wert zeigen.",
    "dm: eine Instagram-DM, die diese Idee als Einstieg nutzt. Lockerer Ton, aber nie anbiedernd.",
    "email: eine E-Mail auf Deutsch im professionellen Sie-Ton, die auf dieselbe Idee aufbaut.",
    "",
    "Verbindliche Stilregeln, strikt einhalten:",
    "- direkt, respektvoll, selbstsicher ohne Arroganz",
    "- kein Verkäufer-Ton, kein übertriebenes Danken",
    "- NIEMALS Gedankenstriche im Text. Verwende keine langen oder kurzen Striche als Satzzeichen. Trenne Sätze stattdessen mit Komma oder strukturiere sie neu.",
    "- kurze, klare Sätze. Ein erklärter Sachverhalt wird vollständig durchgezogen.",
    "- mehrere Fragen immer nummeriert und einzeln aufgelistet, nie in Fließtext vergraben.",
    `- die E-Mail endet immer exakt mit dieser Zeile: "${SIGNATUR}"`,
    "- die DM ist lockerer als die E-Mail, aber nie anbiedernd.",
    "",
    "Antworte nur mit dem JSON-Objekt.",
  ].join("\n");
}

export function buildUserPrompt(lead: Lead): string {
  const lines = [
    `Business: ${lead.name}`,
    `Branche: ${lead.categoryLabel}`,
    lead.address ? `Adresse: ${lead.address}` : "",
    lead.website ? `Website: ${lead.website}` : "Website: keine gefunden",
    typeof lead.instagram === "string"
      ? `Instagram: ${lead.instagram}`
      : lead.instagram === null
        ? "Instagram: kein Account gefunden"
        : "Instagram: nicht geprüft",
    typeof lead.rating === "number" ? `Google-Bewertung: ${lead.rating} bei ${lead.reviewCount ?? 0} Bewertungen` : "",
    `Bewertung als Lead: ${lead.einstufung.replace("_", " ")} (Tier ${lead.tier}, final ${lead.finalScore}/100, Bedarf ${lead.needScore})`,
    "",
    "Schreibe die Content-Idee so spezifisch wie möglich für genau dieses Business.",
  ].filter(Boolean);
  return lines.join("\n");
}
