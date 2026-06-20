import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEAD RADAR // Akquise-Command-Center",
  description:
    "Military-Terminal zur Lead-Akquise: Scan-Karte, Lead-Scoring, Notion-Pipeline und Outreach.",
};

export const viewport: Viewport = {
  themeColor: "#05080a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
