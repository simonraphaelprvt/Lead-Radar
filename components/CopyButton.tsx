"use client";

import { useState } from "react";

export default function CopyButton({
  text,
  label = "KOPIEREN",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback fuer aeltere Browser
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center justify-center px-2 py-1 text-[10px] tracking-widest border transition-colors ${
        copied
          ? "border-phosphor text-phosphor"
          : "border-terminal-border text-phosphor-muted hover:border-phosphor-dim hover:text-phosphor-text"
      } ${className}`}
    >
      {copied ? "✓ KOPIERT" : label}
    </button>
  );
}
