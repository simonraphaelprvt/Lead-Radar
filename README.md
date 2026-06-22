# LEAD RADAR

**Akquise-Command-Center für lokale Businesses.** Ein taktisches Command-Center im Palantir-Stil: entsättigte **Satellitenkarte** (Esri World Imagery, kostenlos, kein Key), Radar-Scan über ein Gebiet, gefundene Businesses werden automatisch als Lead bewertet (HOT / WARM / COLD) und als taktische Marker mit Label-Tags auf der Karte angezeigt, landen in einer Notion-Pipeline und bekommen auf Knopfdruck eine personalisierte Outreach-Nachricht inklusive konkreter Content-Idee.

Gebaut mit **Next.js (App Router) + TypeScript + TailwindCSS + Leaflet** (Raster-Kacheln, browser-robust). Datenquelle **OpenStreetMap / Overpass API** (kostenlos, kein API-Key, kein Billing), Lead-Speicher **Notion API**, Outreach optional über die **Anthropic API**.

---

## Schnellstart (lokal)

```bash
npm install
cp .env.local.example .env.local   # Werte eintragen, siehe unten
npm run dev
```

Dann <http://localhost:3000> öffnen. **Der Scan funktioniert sofort ohne jeden Key** (OpenStreetMap braucht keine Anmeldung). Nur die Notion-Pipeline und der KI-Outreach brauchen die jeweiligen Keys.

---

## Environment Variables

Alle Secrets liegen ausschließlich serverseitig (in `.env.local` lokal bzw. in den Vercel Environment Variables). Nichts davon gelangt ins Client-Bundle.

| Variable | Pflicht | Wofür |
| --- | --- | --- |
| `NOTION_API_KEY` | für Pipeline | Interner Notion-Integration-Token |
| `NOTION_LEADS_DATABASE_ID` | für Pipeline | ID der Notion-Datenbank mit den Leads |
| `ANTHROPIC_API_KEY` | optional | KI-Outreach. Ohne diesen Key läuft der Template-Modus |

Die **Datenquelle braucht keine Variable**: OpenStreetMap / Overpass ist offen, ohne Key, ohne Karte, ohne Billing.

---

## Datenquelle: OpenStreetMap / Overpass (keine Einrichtung)

Es ist **nichts einzurichten**: kein Konto, kein API-Key, kein Billing, keine hinterlegte Karte. Die Scan-Route fragt serverseitig die offene [Overpass-API](https://overpass-api.de/) ab (mit einem zweiten Endpunkt als Fallback).

So wird sparsam und höflich abgefragt:

- Pro Scan geht **eine einzige Union-Abfrage** raus, die alle gewählten Branchen abdeckt (nicht eine pro Kategorie).
- Identische Suchen (gleiche Position auf 4 Nachkommastellen, gleicher Radius, gleiche Kategorien) werden im **localStorage gecacht** (24h) und lösen keine neue Abfrage aus.
- Die HUD oben zeigt einen **Request-Zähler** (`API CALLS`), hier ohne Kosten.

### Was OSM liefert (und was nicht)

OpenStreetMap kennt Name, Adresse, Website, Telefon, Öffnungszeiten, Branchen-Tags und teils sogar `contact:instagram` direkt. Was OSM **nicht** hat: Sterne-Bewertung, Bewertungsanzahl und Preisniveau. Das Scoring kommt damit klar (siehe unten), es stützt sich dann stärker auf Website-/Instagram-Vorhandensein und Branche. Die Abdeckung in Deutschland ist für Gastronomie, Handwerk und lokale Geschäfte gut.

---

## Notion einrichten

1. Auf <https://www.notion.so/my-integrations> eine **interne Integration** anlegen. Den *Internal Integration Secret* als `NOTION_API_KEY` setzen.
2. Eine **Datenbank** anlegen mit genau diesen Properties (Name → Typ):

| Property | Typ |
| --- | --- |
| `Name` | Title |
| `Status` | Select (Optionen: Neu, Angeschrieben, Termin, Kunde, Abgelehnt) |
| `Bewertung` | Select (Optionen: HOT, WARM, COLD) |
| `Score` | Number |
| `Bedarf` | Number |
| `Zahlungskraft` | Number |
| `Fit` | Number |
| `Branche` | Text (Rich Text) |
| `Instagram` | URL |
| `Telefon` | Phone |
| `Website` | URL |
| `Adresse` | Text (Rich Text) |
| `Google Maps` | URL |
| `Anzahl Bewertungen` | Number |
| `Notizen` | Text (Rich Text) |
| `Hinzugefügt am` | Date |

   Die Select-Optionen müssen nicht von Hand angelegt werden, Notion legt fehlende Optionen beim Schreiben automatisch an. Sauberer ist es, sie vorzudefinieren.
3. Die Datenbank mit der Integration **teilen**: Datenbank öffnen → "•••" → "Connections" → die Integration hinzufügen.
4. Die **Database-ID** aus der URL kopieren (der 32-stellige Hex-Block) und als `NOTION_LEADS_DATABASE_ID` setzen.

### Property-Namen anpassen

Alle Property-Namen liegen zentral als Konstante in [`lib/constants.ts`](lib/constants.ts) unter `NOTION_PROPS`. Wer eine bestehende Datenbank mit anderen Spaltennamen nutzt, ändert nur dort. Wer `Branche` als Select statt Text oder `Telefon` als Text statt Phone führt, passt zusätzlich die Bauweise in [`lib/notion.ts`](lib/notion.ts) (`leadToProperties`) an.

---

## Anthropic Key (optional, für KI-Outreach)

Ohne Key läuft der **Template-Modus**: regelbasierte Content-Ideen je Branche plus vorgefüllte DM- und E-Mail-Vorlagen. Mit `ANTHROPIC_API_KEY` schaltet die App in den **KI-Modus** (`claude-sonnet-4-6`), der die Texte individuell auf die Lead-Daten zuschneidet. Die Stilregeln (Sie-Ton in der E-Mail, keine Gedankenstriche, nummerierte Fragen, Abschluss "Mit freundlichen Grüßen, Simon Raphael Moser") werden im System-Prompt erzwungen und zusätzlich nachgereinigt.

---

## Deployment auf Vercel

1. Repo zu GitHub pushen, in Vercel als neues Projekt importieren (Framework wird als Next.js erkannt).
2. Die (bis zu drei) Environment Variables unter **Project Settings → Environment Variables** anlegen (für Production und Preview). Für reines Scannen + Outreach-Template braucht es sogar gar keine.
3. Deploy. Es ist keine weitere Anpassung nötig, die API-Routes laufen automatisch als Serverless Functions.

---

## Bedienung

1. **Pin setzen:** in den Map-Modus, mit Klick auf die Karte den Zielpunkt setzen (oder den vorhandenen Pin ziehen). Radius per Slider (1 bis 25 km).
2. **Branchen wählen:** im Panel links eine oder mehrere Kategorien anklicken.
3. **Scan starten:** der Radar-Sweep läuft, Treffer erscheinen farbcodiert (HOT rot pulsierend, WARM bernstein, COLD grün-grau) und parallel in der **Liste**.
4. **Lead öffnen:** Klick auf Pin oder Listeneintrag öffnet den Detail-Drawer. Ganz oben hervorgehoben: **Instagram** und **Telefon**.
5. **Anreichern:** "Anreichern" im Drawer (oder "Instagram-Batch" im Panel) holt serverseitig die Firmen-Website und sucht den Instagram-Handle. Wird keiner gefunden, steht ehrlich "nicht gefunden".
6. **Outreach:** "Outreach erstellen" generiert Content-Idee, DM und E-Mail, jeweils mit Kopieren-Button.
7. **In Pipeline:** schreibt den Lead nach Notion. Im **Pipeline**-Board lässt sich der Status per Dropdown oder Drag-and-drop ändern, das schreibt direkt zurück.
8. **Export:** CSV aller Leads (Panel) oder "Als Markdown kopieren" pro Lead (Drawer, Obsidian-tauglich mit Frontmatter).

---

## Das Scoring-Modell

Das Herzstück liegt in [`lib/scoring.ts`](lib/scoring.ts), die Branchen-Gewichte in [`lib/categories.ts`](lib/categories.ts). **Alle Gewichte und Schwellen sind Konstanten** (`SCORING_CONFIG`) und leicht änderbar.

Drei Achsen, jeweils 0 bis 100:

- **Zahlungskraft (`pay`):** primär aus der Branche (Tier-Spanne). `priceLevel` und `userRatingCount` würden sie verfeinern, OpenStreetMap liefert diese aber nicht, daher zählt hier die Branche. Die Tier-Grenzen werden hart geklemmt, damit niedrige Branchen (Imbiss, Kiosk) niedrig bleiben.
- **Bedarf (`need`):** keine Website (stärkstes Signal, OSM hat das `website`-Tag), kein Instagram trotz Geschäft, optional der manuelle "sucht Personal"-Haken.
- **Branchen-Fit (`fit`):** Eignung als Social-Media-Retainer-Kunde. Voll für Kernbranchen (Gastro, Automotive, Nightlife, Fitness, Hospitality, Beauty, Immobilien), abgestuft darunter.

Gesamtbewertung:

- **Fit ist ein Gate:** unter `FIT_GATE` (60) maximal COLD.
- **Zahlungskraft ist die Bremse:** unter `PAY_COLD_CEILING` (40) immer COLD, egal wie hoch der Bedarf. Imbiss / Döner / Kiosk werden so nie HOT.
- **HOT:** `pay ≥ 65` UND `need ≥ 50` UND `fit ≥ 60`.
- **WARM:** stark in mindestens zwei Achsen, aber nicht alle HOT-Bedingungen.
- **COLD:** alles andere.

Der Gesamt-Score nutzt Zahlungskraft als Multiplikator auf den Bedarf: `need × (0.3 + 0.7·pay/100) × (0.6 + 0.4·fit/100)`.

---

## Architektur

```
app/
  page.tsx              Orchestrator (State, Cache, Handler)
  layout.tsx            Root-Layout
  globals.css           Taktisches Theme (Navy/Grau, Cyan-Akzent, Marker/Tags)
  api/
    places/route.ts     OpenStreetMap/Overpass: suchen + scoren
    enrich/route.ts     Instagram aus Firmen-Website
    notion/leads/route.ts  GET Pipeline, POST Lead, PATCH Status
    outreach/route.ts   KI- oder Template-Outreach
components/             Map, HUD, SearchPanel, LeadList, LeadDrawer, PipelineBoard, ...
lib/
  scoring.ts            Lead-Scoring-Modell (Herzstück)
  categories.ts         Branchen-Katalog + OSM-Tags
  constants.ts          Notion-Property-Namen, App-Config
  overpass.ts           OpenStreetMap/Overpass-Client (kein Key)
  notion.ts             Notion-Client (raw fetch)
  instagram.ts          HTML-Parser für Instagram-Handle
  outreach.ts           Prompts + Template-Generierung
  exporters.ts          CSV + Markdown
  types.ts              Zentrale Typen
```

---

## Bewusst nicht gebaut (Grenzen)

- **Kein Instagram-Scraping** über das Ziehen des Links von der Firmen-Website hinaus. Keine Follower, keine Post-Historie.
- **Kein Indeed-Scraping.** Das Signal "sucht aktiv Social-Media-Personal" ist ein manuell setzbarer Haken pro Lead, der den Bedarf anhebt.
- **Kein Login, keine Nutzer-Accounts.** Single-User-Tool.

## Getroffene Annahmen / Vereinfachungen

- **Datenquelle:** Auf ausdrücklichen Wunsch ohne Billing läuft die App über OpenStreetMap / Overpass statt Google Places. Dadurch keine Sterne-Bewertung / Bewertungsanzahl / Preisniveau, dafür null Kosten und keine Anmeldung. Der Umstieg betrifft nur `lib/overpass.ts`, `lib/categories.ts` und `app/api/places/route.ts`.
- **Rechteck-Gebiet:** Die App nutzt den Kreis-Radius als primäre Suchgeometrie. Das im Auftrag erwähnte alternative Rechteck-Aufziehen ist nicht implementiert, der Kreis deckt den Anwendungsfall vollständig ab.
- **Clustering** ist als leichtes Pixel-Raster-Clustering umgesetzt (kein schwergewichtiges Supercluster).
- **Notion-Pagination** für die Pipeline ist implementiert (alle Seiten werden gelesen).
- **Default-Kartenzentrum** ist die Region Gießen / Laubach. Anpassbar in `lib/constants.ts` (`APP_CONFIG.DEFAULT_CENTER`).
```
