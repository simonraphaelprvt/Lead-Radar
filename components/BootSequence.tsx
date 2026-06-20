"use client";

import { useEffect, useState } from "react";

const LINES = [
  "LEAD RADAR v1.0  //  AKQUISE-COMMAND-CENTER",
  "> initialisiere subsysteme .......... OK",
  "> lade scoring-modell (3 achsen) .... OK",
  "> verbinde notion-pipeline .......... STANDBY",
  "> google places api (new) ........... BEREIT",
  "> kartendienst CARTO dark-matter .... ONLINE",
  "> kalibriere radar-array ............ OK",
  "",
  "SYSTEM BEREIT. Pin setzen und Scan starten.",
];

export default function BootSequence({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (visible >= LINES.length) {
      const t = setTimeout(() => {
        setClosing(true);
        setTimeout(onDone, 500);
      }, 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisible((v) => v + 1), 230);
    return () => clearTimeout(t);
  }, [visible, onDone]);

  return (
    <div
      onClick={() => {
        setClosing(true);
        setTimeout(onDone, 200);
      }}
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-terminal-bg cursor-pointer transition-opacity duration-500 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="grid-bg absolute inset-0 opacity-40" />
      <div className="relative w-[min(620px,90vw)] p-6 font-mono text-sm text-phosphor-text flicker">
        {LINES.slice(0, visible).map((line, i) => (
          <div
            key={i}
            style={{ animation: "boot-line 0.2s ease both" }}
            className={
              line.startsWith("SYSTEM")
                ? "mt-2 text-phosphor glow-text"
                : line.includes("OK") || line.includes("ONLINE") || line.includes("BEREIT")
                  ? "text-phosphor-text"
                  : "text-phosphor-muted"
            }
          >
            {line || " "}
          </div>
        ))}
        {visible < LINES.length && (
          <span className="inline-block w-2 h-4 bg-phosphor align-middle blink" />
        )}
        <div className="mt-6 text-[10px] text-phosphor-muted/60 tracking-widest">
          [ klicken zum überspringen ]
        </div>
      </div>
    </div>
  );
}
