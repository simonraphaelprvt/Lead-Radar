"use client";

export type AppView = "map" | "pipeline" | "list";

const VIEWS: { id: AppView; label: string }[] = [
  { id: "map", label: "MAP" },
  { id: "pipeline", label: "PIPELINE" },
  { id: "list", label: "LISTE" },
];

export default function ViewSwitcher({
  view,
  onChange,
}: {
  view: AppView;
  onChange: (v: AppView) => void;
}) {
  return (
    <div className="flex border border-terminal-border">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          onClick={() => onChange(v.id)}
          className={`px-3 py-1.5 text-[11px] tracking-widest transition-colors border-r border-terminal-border last:border-r-0 ${
            view === v.id
              ? "bg-phosphor-dim/30 text-phosphor glow-text"
              : "text-phosphor-muted hover:text-phosphor-text hover:bg-white/5"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
