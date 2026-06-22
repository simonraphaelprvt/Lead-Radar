# CLAUDE.md — Lead Radar

Kontext-Datei für Claude Code. Enthält **alles**, was ein neuer Chat über dieses Projekt wissen muss: Zweck, Stack, Architektur, alle externen Connectors, das **Reasoning-Modell**, getroffene Entscheidungen (inkl. der Gründe) und die Stolperfallen, die schon Zeit gekostet haben.

> Wenn du an diesem Projekt arbeitest: lies zuerst die Abschnitte **Wichtige Entscheidungen** und **Stolperfallen**. Dort steht, warum bestimmte Dinge so und nicht anders sind. Brich diese nicht ohne Grund.

---

## Was das ist

**Lead Radar** ist Simons persönliches Akquise- und Vertriebs-Werkzeug. Simon ist selbstständiger Content-Stratege/Videograf (Kleingewerbe, Region Laubach/Gießen) und gewinnt lokale & regionale Businesses als Retainer-Kunden für Social-Media-Betreuung (Zielpreis 1.000–3.000 €/Monat pro Kunde).

Die App: eine dunkle **Satellitenkarte** im ruhigen Studio-Stil, auf der per Knopfdruck ein Scan über ein Gebiet läuft. Gefundene Businesses werden durch eine **signalbasierte Reasoning-Engine (v3)** auf EINEN Oberindikator verrechnet (**IN NEED / INTERESTED / COMMON**, plus **RAUS** aus dem KO-Filter), erscheinen als farbcodierte Marker (rot/orange/blau) und in einer sortierbaren Liste. Leads landen in einer **Notion-Pipeline** und bekommen auf Knopfdruck personalisierten **Outreach** (Content-Idee + Instagram-DM + E-Mail).

Single-User-Tool. Kein Login, keine Accounts.

---

## Stack

- **Next.js 15 (App Router) + TypeScript + TailwindCSS**
- **Leaflet** für die Karte (Raster-Kacheln, KEIN MapLibre/WebGL — siehe Stolperfallen)
- **Inter** (UI) + **JetBrains Mono** (Zahlen/Scores) via `next/font` (`app/layout.tsx`)
- Deployment: **Vercel** (API-Routes als Serverless Functions)
- Notion, Anthropic und Google werden serverseitig per `fetch` angesprochen (keine SDKs).

```bash
npm install
npm run dev      # lokal, http://localhost:3000
npm run build    # Production-Build (type-check inklusive)
```

---

## Connectors (externe Dienste)

| Dienst | Wofür | Key nötig? | Wo im Code |
| --- | --- | --- | --- |
| **Google Places API (New)** | Scan-Datenquelle: Businesses + harte Signale (Rating, Reviews, Preislevel, Fotos, Typ) | **Ja** (`GOOGLE_MAPS_API_KEY`) | `lib/places.ts`, `lib/scan.ts`, `app/api/places/route.ts` |
| **Google Places (Details/Foto) + Street View Static** | pro Lead: Telefon/Adresse/Öffnungszeiten + Standort-Foto | Ja (gleicher Key) | `lib/google.ts`, `app/api/google/*` |
| **Esri World Imagery** | Satelliten-Kacheln | Nein | `components/MapView.tsx` |
| **CARTO dark_only_labels** | dunkle Orts-Labels über dem Satellit | Nein | `components/MapView.tsx` |
| **Notion API** | Lead-Speicher & Pipeline | Ja (`NOTION_API_KEY` + DB-ID) | `lib/notion.ts`, `app/api/notion/leads/route.ts` |
| **Anthropic API** | KI-Outreach (`claude-sonnet-4-6`) | Optional | `app/api/outreach/route.ts`, `lib/outreach.ts` |
| **Vercel** | Hosting/Deploy | — | linked Project |

### Google (Scan + Anreicherung)
- **Scan läuft SERVER-SEITIG** (`app/api/places` → `lib/scan.ts` → `lib/places.ts`), weil der Key geheim bleiben muss. `lib/places.ts` macht pro gewählter Branche EINEN `places:searchText`-Call (bis 20 Treffer) mit Field-Mask für `rating, userRatingCount, priceLevel, photos, types, websiteUri, …`.
- **Bild-Proxy**: `app/api/google/image` streamt Place-Foto bzw. Street-View-Standbild, damit der Key nie in den Browser kommt. Lead-Foto + Öffnungszeiten werden beim **Öffnen** eines Leads nachgeladen (`/api/google`, gecacht in localStorage).
- Benötigte APIs im Google-Cloud-Projekt: **Places API (New)** + **Street View Static API**, Billing aktiv. Ein Key (`GOOGLE_MAPS_API_KEY`), nur serverseitig.
- **Match-Regel:** Bei `searchText` gewinnt Googles ERSTER (relevanzbester) Treffer, NICHT der räumlich nächste. Nur eine 2-km-Plausi-Bremse. (Sonst klaut bei dicht beieinander liegenden Betrieben der Nachbar Foto/Telefon — siehe Stolperfallen.)

### Notion (Pipeline)
- Interne Integration. `NOTION_API_KEY` + `NOTION_LEADS_DATABASE_ID`. DB muss mit der Integration geteilt sein.
- Property-Namen zentral in `lib/constants.ts` → `NOTION_PROPS`. Mapping (v3): `Bewertung` = Oberindikator (Label „IN NEED"/„INTERESTED"/„COMMON"/„RAUS"), `Score` = `final_score`, die Zahlenspalten `Zahlungskraft/Bedarf/Fit` tragen jetzt die echten Rohachsen `pay/need/fit`. `pageToLead` mappt Legacy-Werte (HOT/WARM/COLD) sauber auf die neuen. API-Version `2022-06-28`.

### Anthropic (Outreach)
- Optional. Ohne `ANTHROPIC_API_KEY` → Template-Modus (`lib/outreach.ts`). Mit Key → KI-Modus, Modell `claude-sonnet-4-6`, `anthropic-version: 2023-06-01`.
- Stilregeln: E-Mail Sie-Ton, **NIEMALS Gedankenstriche**, kurze Sätze, Fragen nummeriert, Abschluss exakt `Mit freundlichen Grüßen, Simon Raphael Moser`. Output JSON `{contentIdea, dm, email}`. Content-Idee verzweigt über `categoryKey(lead)` (Keyword aus `categoryLabel`).

---

## Environment Variables

```
GOOGLE_MAPS_API_KEY=       # PFLICHT für Scan + Lead-Foto/Telefon (Google Places New + Street View Static, Billing aktiv)
NOTION_API_KEY=            # für Pipeline
NOTION_LEADS_DATABASE_ID=  # für Pipeline
ANTHROPIC_API_KEY=         # optional, für KI-Outreach
```
Lokal in `.env.local`, live in Vercel → Settings → Environment Variables. Ohne Google-Key liefert der Scan nichts (es ist die Datenquelle); das Lead-Foto/Telefon fällt ohne Key sauber auf Website-Bild/Satellit + Ein-Klick-Links zurück.

---

## Architektur / Dateien

```
app/
  page.tsx               Orchestrator: State, localStorage-Cache, Handler, Server-Scan-Aufruf, Live-Requalify
  layout.tsx             Root-Layout + Inter/Mono-Fonts
  globals.css            Studio-Theme (dunkel) + Leaflet-Styles + ruhige Marker
  api/
    places/route.ts      Scan: Google Bulk-Qualify + Reasoning-Engine (nutzt lib/scan)
    google/route.ts      pro Lead: Telefon/Adresse/Öffnungszeiten + Foto-URL (Places Details + Street View)
    google/image/route.ts  Bild-Proxy (Place-Foto / Street View), Key bleibt serverseitig
    notion/leads/route.ts  GET Pipeline / POST Lead / PATCH Status
    outreach/route.ts    KI- oder Template-Outreach
components/
  MapView.tsx            Leaflet (Satellit + Labels, ruhige Tier-Pins, Origin-Pin, Radius-Kreis)
  Hud.tsx                Kopfleiste: Oberindikator-Zähler (IN NEED/INTERESTED/COMMON/RAUS) + Ansicht-Umschalter
  SearchPanel.tsx        Radius, Ketten-Toggle, Branchen (ohne "low"-Sektor), Scan-Button
  LeadList.tsx           Tabelle: Oberindikator + Rohwert-Spalten (final/pay/need/fit/pain) + Tier, Such-/Stufen-Filter, Presets
  LeadDrawer.tsx         Detail: Foto-Hero, Verrechnung (pay/need/fit-Achsen), Pain-Signal-Aufschlüsselung (✓/—/?), Erstkontakt-Checkliste
  PipelineBoard.tsx      Kanban aus Notion
  Badges.tsx             EinstufungBadge (IN NEED/INTERESTED/COMMON/RAUS) + TierBadge
  SatelliteThumb.tsx     statisches Esri-Luftbild (Fallback, wenn kein Google-Foto)
  OutreachPanel.tsx, ViewSwitcher.tsx, CopyButton.tsx
lib/
  reasoning.ts           ENGINE v3 (Herzstück): Config + KO + pay/need/fit + Pain-Signale + Verrechnung -> IN NEED/INTERESTED/COMMON
  enrich.ts              Website-/Instagram-Fetch (server-only): HTTPS/Responsive/Baukasten/IG-Handle -> speist need + Pain-Signale
  places.ts              Google Bulk-Qualify -> BusinessSignals
  scan.ts                Scan-Orchestrierung (server): places + enrich + reasoning -> bewertete Leads, sortiert
  google.ts              Google Places Details + Street View (Lead-Foto/Telefon, server-only)
  categories.ts          Branchen-Katalog (Labels = Google-Suchbegriffe, Gruppen core/adjacent/low/b2b)
  constants.ts           NOTION_PROPS, RATING_COLORS, APP_CONFIG, Storage-Keys
  notion.ts              Notion-Client (raw fetch, 2022-06-28)
  outreach.ts            KI-Prompts + Template-Generierung + Dash-Sanitizer
  exporters.ts           CSV + Obsidian-Markdown
  types.ts               zentrale Typen (Lead trägt die Engine-Felder direkt)
```

(Entfernt beim Umbau auf die Engine: `lib/scoring.ts`, `lib/overpass.ts`, `lib/instagram.ts`, `components/ScoreBars.tsx`, `app/api/enrich`. Der alte OSM/Overpass-Scan ist komplett raus.)

---

## Such-Flow & Cache

1. Pin auf der Karte setzen (Klick) oder ziehen, Radius-Slider (1–25 km).
2. Branchen wählen, optional Ketten-Filter umschalten.
3. „Scan starten" → `POST /api/places` → Google holt pro Branche bis 20 Businesses MIT Signalen → `qualify()` bewertet jeden → sortierte Leads (HOT > WARM > COLD > RAUS, Tier-C/on_hold ans Ende).
4. **Cache (localStorage):** identische Suchen kommen 24 h aus dem Cache (`v5|`-Präfix — bei jeder Änderung der Lead-Form HOCHZÄHLEN, sonst liefern alte Caches inkompatible Leads → Crash/Fehlanzeige). Google-Kontaktdaten/Foto pro Lead separat gecacht.
5. **Ketten-Toggle wirkt live**: Beim Umschalten werden die Leads im Browser über `qualify()` neu bewertet (`requalify` in `page.tsx`) — kein Re-Scan nötig, weil alle Signale im Lead stecken und die Engine rein ist.

---

## Reasoning-Engine v3 (Herzstück) — `lib/reasoning.ts`

**Kernregel (nicht wegoptimieren): Es ist ein Signal-Problem.** Die Engine bewertet AUSSCHLIESSLICH Signale, die real in den Daten stehen. Was nicht prüfbar ist, bleibt „im Erstkontakt prüfen" und wird **nie gescort/erfunden**. Alle Schwellen/Listen stehen oben in `REASONING_CONFIG` (tunebar).

**EINZIGER Oberindikator** (das, was auf der Karte zählt): **IN NEED / INTERESTED / COMMON** (+ **RAUS** aus dem KO). Die Rohachsen sind die Begründung dahinter und wandern in Liste/Detail, NICHT auf die Karte.

Pipeline pro Business:
1. **KO-Filter** (ein Treffer → `RAUS`): Kette (`KETTEN_BLACKLIST`, **umschaltbar** via `filterChains`), Fast-Food/Imbiss/Döner (harte KO), Dienstleistung ohne Anker, keine eigene Website + wenige Reviews, schwaches Rating bei wenig Volumen, Auto-Mini-Hütte.
2. **Rohachsen (je 0–100):** `pay_score` (Branchen-Basis × Preislevel × Größe/Reviews × Auto-Marke), `need_score` (grob branchenbasiert: keine/aggregierte Website, etabliert-aber-unsichtbar, **plus Enrichment-Signale**: Baukasten, keine IG-Präsenz, IG inaktiv, nicht responsive), `fit_score` (Passung zu Simons Kernbranchen: Gastro/Automotive/Nightlife/Fitness/Hospitality).
3. **Pain-Signale (einzeln belegt):** jedes Signal trägt `weight` (hoch/mittel/niedrig), `found`, `pruefbar` und einen konkreten `beleg`. `pain_match_score` = gewichtete Summe der GEFUNDENEN Signale (hoch 45 / mittel 25 / niedrig 12, clamp 100). Signale aus Places (keine Website, etabliert-unsichtbar, Produkt-ohne-Sichtbarkeit, Fachkräftemangel-Branche) sind immer prüfbar; IG-/Website-Tech-Signale nur mit Enrichment, sonst `pruefbar:false → Erstkontakt`.
4. **Verrechnung:** `zwischen = need × (0.5 + 0.5·pain/100)` (Pain verstärkt Need), `final = zwischen × (0.3 + 0.7·pay/100)` (Pay als Gate+Multiplikator). **fit < 40 → max COMMON.**
5. **Oberindikator (scharfe Schwellen):** **IN NEED** = final ≥ 65 **und** pay ≥ 65 **und** fit ≥ 60 **und** ≥1 belegtes High-Weight-Pain. **INTERESTED** = final ≥ 40 und fit ≥ 50. Sonst **COMMON**. (Konsequenz der Multiplikation: IN NEED erreicht praktisch nur ein quasi-unsichtbarer Betrieb — meist OHNE eigene Website. Bewusst so „verschärft".)
6. **Output** (`QualifiedLead`): einstufung, tier (+`tier_c_on_hold`=off-profile), pay/need/fit/pain_match/final, `pay`/`need`/`fit` (Teilscores mit Signalen), `pain_signals[]`, ko_grund, im_erstkontakt_pruefen (4× `unbekannt`), empfehlung, begruendung_kurz.

`Lead` (in `types.ts`) trägt diese Felder direkt (+ Enrichment-Felder `site*`/`instagramHandle`/`ig*`); `scan.ts` mappt `BusinessSignals` + `QualifiedLead` → `Lead`. Die Engine ist rein → `requalify` (Ketten-Toggle) rechnet live im Browser neu.

### Enrichment — `lib/enrich.ts` (server-only, Layer im Scan)
Pro Nicht-KO-Lead mit Website wird die Seite gefetcht (best-effort, Concurrency-Pool 10, hartes 28s-Budget — hängt den Scan nie auf) und liefert REALE Datenpunkte: HTTPS, Responsive-Viewport, erkannter Baukasten (Wix/Jimdo/…), verlinktes **Instagram-Handle** und best-effort IG-Aktivität (meist `null` → ehrlich „nicht ermittelbar"). Diese Signale speisen `need_score` und die Pain-Signale 5–7. Ergebnisse liegen auf dem Lead (Cache + reines Requalify).

---

## Optik / Design-Richtung

**Ruhiges, dichtes Studio — wie Linear / Vercel-Dashboard / Stripe / Mercury. NICHT Game-HUD/Terminal.**
Bewusst NICHT: Scanlines, Glow, Radar-Sweep, Boot-Sequenz, pulsierende Pins, Neon auf Schwarz, Mono als durchgehende UI-Schrift.
Stattdessen: sehr dunkle neutrale Basis (`#0B0B0C`), viel Grau, EIN ruhiger entsättigter Blau-Akzent (`#6E92C9`). Inter fürs UI, Mono nur für Zahlen/Scores/IDs. **Oberindikator-Farben:** IN NEED `#DA5B4A` (rot), INTERESTED `#D9913F` (orange), COMMON `#6E8FB0` (blau), RAUS `#46464A` (ausgegraut) — Tokens `--in-need`/`--interested`/`--common` in `globals.css`, Marker-Klassen `.mk--in_need|interested|common|raus`. Farbe nur als kleiner Marker/Rand. Karte = Satellit, leicht abgedunkelt; Pins schlicht, ausgewählter Pin = ruhiger Ring (keine Dauer-Animation). Motion 120–200 ms, ease-out, nur funktional.
Farb-Tokens in `tailwind.config.ts` (Gruppen heißen historisch `terminal`/`phosphor`) + CSS-Variablen in `globals.css`.

---

## Wichtige Entscheidungen (und warum)

1. **Google Places als Scan-Datenquelle (kehrt die alte „kein Billing"-Regel um).** Die Engine braucht harte Signale (Rating/Reviews/Preislevel/Fotos), die OSM/Overpass NICHT liefert — ohne sie halluziniert das Scoring (genau der alte Müll). Google liefert sie. Bulk-`searchText` pro Branche (~10–20 Calls/Scan = wenige Cent). Simon hat dafür bewusst Billing aktiviert; Key nur serverseitig, in Google Cloud auf die 2 nötigen APIs beschränken + Budget-Limit setzen.
2. **Signalbasierte Engine statt Vibe-Scoring.** Nur reale Signale scoren, Rest = `unbekannt`. KO-Filter zuerst (killt Ketten/Fast-Food/Anker-lose Dienstleister/Mini-Autohütten). Kalibrierung: Fast-Food = harte KO, HOT-Schwelle 80 + Reviews stärker/weniger gesättigt gewichtet.
3. **Leaflet (Raster) statt MapLibre (WebGL)** — MapLibre rendert in Simons Safari schwarz. Leaflet mit `<img>`-Kacheln ist browser-robust. Karte ist **Satellit** (Esri), nicht die monochrome Dark-Map (Simon will Satellit).
4. **Ketten-Filter als Live-Toggle** — re-qualifiziert die Liste im Browser (Engine ist rein, alle Signale stecken im Lead), kein Re-Scan.
5. **„low"-Branchen (Imbiss/Kiosk/Bäckerei) nicht mehr im UI** — passen nicht zum Retainer-Zielpreis; Fast-Food fliegt ohnehin per KO raus.

---

## Stolperfallen (nicht erneut reinlaufen)

- **Substring-Keyword-Matching ist gefährlich.** `"it"` (für IT/Software) matchte als Teilstring in „f**it**ness", und ein Google-Typ („…**location**") zog Fitness fälschlich nach Tier A. Tier-Matching nutzt deshalb NUR das saubere `categoryLabel` (`labelHay`), nicht die verrauschten Google-`types`; Tier B wird vor A geprüft. Keine ultrakurzen Keywords in die Tier-Listen.
- **Google-`searchText`: ersten Treffer nehmen, NICHT nach Distanz sortieren.** Sonst gewinnt bei mehreren nahen Betrieben der falsche (Foto/Telefon des Nachbarn). `lib/google.ts` nimmt `places[0]` + 2-km-Plausi.
- **Google-Website NICHT ins Scoring übernehmen.** Ein mobile.de-/AutoScout-Eintrag ist keine echte eigene Website und würde das Signal „keine Website = Bedarf" verfälschen. Google füllt nur Kontaktdaten/Foto, nie die Bewertung.
- **KEIN CSS-`filter` auf `.leaflet-tile-pane`** → laggt + weiße Aufblitzer in Safari. Abdunkeln über Tile-`opacity`.
- Karte braucht **`isolate`** im Wrapper + **`map.invalidateSize()`** (ResizeObserver + Timeout), sonst übermalen Leaflets z-index-Panes die Overlays bzw. bleiben Kacheln grau.
- **React Fast-Refresh meckert**, wenn man die Länge eines `useEffect`-Dependency-Arrays live ändert („final argument changed size between renders"). Reines HMR-Artefakt, in Produktion irrelevant — ein sauberer Dev-Server-Neustart räumt es weg.
- **Overpass/OSM ist raus** — falls du alten Code suchst: `lib/scoring.ts`/`overpass.ts`/`instagram.ts` wurden entfernt.
- **Lead-Form geändert → Cache-Präfix (`v5|` in `page.tsx`) hochzählen.** Sonst lädt der 24h-Cache alte Leads ohne die neuen Felder → Zähler/Liste brechen (genau so beim v3-Umbau passiert).
- **Instagram-Aktivität ist server-seitig kaum scrapebar** (Login-Wall). `enrich.ts` zieht das IG-Handle aus der Website (zuverlässig), aber das Last-Post-Datum bleibt meist `null` → Signal „IG inaktiv" ehrlich „nicht prüfbar → Erstkontakt". NICHT anfangen zu raten.
- **IN NEED ist absichtlich selten** (Multiplikation need×pain×pay + scharfe Schwellen). Wenn ein Scan 0× IN NEED zeigt, ist das meist KORREKT (Betriebe mit eigener Website kommen kaum über INTERESTED). Nicht „nachhelfen", ohne die Schwellen in `REASONING_CONFIG` bewusst zu ändern.
- Bei lokalem Testen: nie `npm run build` während `npm run dev` läuft (beide schreiben `.next`).

---

## Bewusst NICHT gebaut

- Kein Scoring der nicht-scrapebaren Kriterien (Entscheider erreichbar / Gesicht zeigen / Langfristigkeit / Chaos) — die bleiben `unbekannt`, Checkliste im Drawer.
- Kein Login / keine Nutzer-Accounts.

---

## Deployment

Vercel-Projekt verknüpft (`simonraphaelcontact-8340s-projects/lead-radar`, live unter `lead-radar-mu.vercel.app`). Env-Variablen (inkl. `GOOGLE_MAPS_API_KEY`) sind in Vercel gesetzt.

```bash
cd ~/Downloads/lead-radar
npx vercel --prod
```

Falls Token abgelaufen: `npx vercel login`.
