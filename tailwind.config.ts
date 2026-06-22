import type { Config } from "tailwindcss";

/**
 * Studio-Look v2 (Linear / Vercel / Stripe-Richtung): sehr dunkle neutrale
 * Basis (#0B0B0C), viel Grau, EIN ruhiger Akzent. Kein Neon, kein Glow.
 *
 * Hinweis: die Token-Gruppen heissen aus historischen Gruenden "terminal"
 * (Flaechen) und "phosphor" (Akzent/Text); sie tragen jetzt die ruhige
 * Studio-Palette.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#0B0B0C", // App-Hintergrund (fast schwarz, neutral)
          panel: "#141416", // Panel-Flaeche
          "panel-2": "#1A1A1D", // leicht heller
          border: "#262629", // dezenter 1px-Rahmen
          grid: "#1A1A1D",
        },
        phosphor: {
          DEFAULT: "#6E92C9", // ruhiger, entsaettigter Blau-Akzent
          dim: "#2E3A4A", // gedaempft (Rahmen/aktive Flaechen)
          glow: "#8AA8D6",
          text: "#ECECEE", // klarer heller Text
          muted: "#8A8A8F", // sekundaerer Text
          dimtext: "#5A5A60", // tertiaer
        },
        amber: {
          DEFAULT: "#C79A5B", // gedaempftes Sand/Amber (WARM)
          dim: "#4A3C22",
        },
        status: {
          hot: "#DA5B4A", // kraeftig, aber nicht neon
          warm: "#C79A5B", // gedaempftes Amber/Sand
          cold: "#7A7A80", // neutrales Grau
          raus: "#46464A", // stark zurueckgenommen, fast ausgegraut
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      borderRadius: {
        md: "8px",
        lg: "10px",
        xl: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
