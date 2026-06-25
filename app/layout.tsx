import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AccessGate from "@/components/AccessGate";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lead Radar",
  description:
    "Signalbasierte Lead-Qualifizierung: Scan-Karte, Reasoning-Engine, Notion-Pipeline und Outreach.",
};

export const viewport: Viewport = {
  themeColor: "#0B0B0C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <main>
          <AccessGate>{children}</AccessGate>
        </main>
      </body>
    </html>
  );
}
