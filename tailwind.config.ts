import type { Config } from "tailwindcss";

/**
 * Military-Terminal-Theme.
 * Leitfarbe: Phosphor-Gruen. Status-Farben fuer Pins: HOT (rot), WARM (bernstein), COLD (gruen-grau).
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#05080a",        // Haupt-Hintergrund, fast schwarz
          panel: "#0a1110",     // Panel-Flaechen
          "panel-2": "#0d1614", // leicht heller
          border: "#16302a",    // feine Rahmen
          grid: "#0f211d",      // Grid-Linien
        },
        phosphor: {
          DEFAULT: "#39ff8b",   // Leitfarbe
          dim: "#1f7a52",       // gedaempft
          glow: "#7dffb6",      // hell fuer Highlights
          text: "#9ff5c4",      // Standard-Textfarbe
          muted: "#4d7a66",     // sekundaerer Text
        },
        amber: {
          DEFAULT: "#ffb000",
          dim: "#7a5400",
        },
        status: {
          hot: "#ff3b3b",
          warm: "#ffb000",
          cold: "#6f8f80",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 8px rgba(57,255,139,0.35), 0 0 24px rgba(57,255,139,0.12)",
        "glow-hot": "0 0 10px rgba(255,59,59,0.6), 0 0 24px rgba(255,59,59,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
