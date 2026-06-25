"use client";

import { useEffect, useRef, useState } from "react";

const UNLOCK_KEY = "lr_access_unlocked";
const PASSWORD = "radar";

/**
 * Voll-Screen Zugangs-Sperre im Military-/Hacker-Terminal-Look (Radar-Scope
 * im Hintergrund). Bewusste Ausnahme vom ruhigen Studio-Theme - nur dieser
 * Screen. Passwort: "radar". Entsperrung gilt fuer die Browser-Session.
 */
export default function AccessGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(UNLOCK_KEY) === "1") setUnlocked(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  if (!ready) return null; // vermeidet Hydration-Flash
  if (unlocked) return <>{children}</>;

  return (
    <LockScreen
      onUnlock={() => {
        try {
          sessionStorage.setItem(UNLOCK_KEY, "1");
        } catch {
          /* ignore */
        }
        setUnlocked(true);
      }}
    />
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "denied" | "granted">("idle");
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "granted") return;
    if (code.trim().toLowerCase() === PASSWORD) {
      setStatus("granted");
      setTimeout(onUnlock, 900);
    } else {
      setStatus("denied");
      setAttempts((a) => a + 1);
      setCode("");
      setTimeout(() => setStatus("idle"), 600);
    }
  }

  const bootLines = [
    "LEAD RADAR // TACTICAL ACQUISITION GRID",
    "SECURE TERMINAL v3 · NODE: LAUBACH-01",
    "",
    "> BOOT SEQUENCE ........ [ OK ]",
    "> SATELLITE UPLINK ..... [ ENCRYPTED ]",
    "> REASONING CORE ....... [ ARMED ]",
    "> CLEARANCE LEVEL ...... [ LOCKED ]",
  ];

  return (
    <div className="lr-gate" onClick={() => inputRef.current?.focus()}>
      <style>{CSS}</style>

      {/* Hintergrund-Ebenen */}
      <div className="lr-grid" />
      <div className="lr-radar">
        <div className="lr-ring" style={{ inset: 0 }} />
        <div className="lr-ring" style={{ inset: "17%" }} />
        <div className="lr-ring" style={{ inset: "34%" }} />
        <div className="lr-ring" style={{ inset: "47%" }} />
        <div className="lr-cross lr-cross-h" />
        <div className="lr-cross lr-cross-v" />
        <div className="lr-sweep" />
        <span className="lr-blip" style={{ top: "28%", left: "64%" }} />
        <span className="lr-blip" style={{ top: "57%", left: "38%", animationDelay: "1.3s" }} />
        <span className="lr-blip" style={{ top: "46%", left: "72%", animationDelay: "2.2s" }} />
        <span className="lr-blip" style={{ top: "68%", left: "55%", animationDelay: "3.0s" }} />
      </div>
      <div className="lr-scan" />
      <div className="lr-vignette" />

      {/* Terminal */}
      <div className={`lr-term ${status === "denied" ? "lr-deny" : ""} ${status === "granted" ? "lr-grant" : ""}`}>
        <div className="lr-corner lr-tl" />
        <div className="lr-corner lr-tr" />
        <div className="lr-corner lr-bl" />
        <div className="lr-corner lr-br" />

        {bootLines.map((l, i) => (
          <div key={i} className="lr-line" style={{ animationDelay: `${i * 0.08}s` }}>
            {l || " "}
          </div>
        ))}

        <div className="lr-rule" />

        {status === "granted" ? (
          <div className="lr-grant-msg">
            &gt; ACCESS GRANTED — ENTERING GRID<span className="lr-caret">▋</span>
          </div>
        ) : (
          <form onSubmit={submit} className="lr-prompt">
            <span className="lr-arrow">&gt; ACCESS CODE:</span>
            <span className="lr-inputwrap">
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                type="password"
                autoComplete="off"
                spellCheck={false}
                aria-label="Access code"
                className="lr-input"
              />
              <span className="lr-shadow">
                {"•".repeat(code.length)}
                <span className="lr-caret">▋</span>
              </span>
            </span>
          </form>
        )}

        <div className="lr-status">
          {status === "denied" ? (
            <span className="lr-denied">✕ ACCESS DENIED — INVALID CODE</span>
          ) : status === "granted" ? (
            <span className="lr-ok">■ CLEARANCE VERIFIED</span>
          ) : (
            <span className="lr-hint">■ authorized personnel only · unauthorized access is logged</span>
          )}
          {attempts > 0 && status !== "granted" && (
            <span className="lr-att"> · failed attempts: {attempts}</span>
          )}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.lr-gate{
  position:fixed; inset:0; z-index:100; overflow:hidden;
  background:#04070a;
  font-family: var(--font-mono, ui-monospace, monospace);
  color:#5cf3b0;
  display:grid; place-items:center;
  cursor:text;
  animation: lr-flick 6s infinite;
}
.lr-grid{
  position:absolute; inset:0;
  background-image:
    linear-gradient(rgba(0,255,140,0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,255,140,0.045) 1px, transparent 1px);
  background-size:42px 42px;
  mask-image: radial-gradient(circle at center, #000 30%, transparent 85%);
}
.lr-radar{
  position:absolute; left:50%; top:50%; width:82vmin; height:82vmin;
  transform:translate(-50%,-50%); border-radius:50%;
  background:radial-gradient(circle, rgba(0,255,140,0.07) 0%, rgba(0,40,24,0.0) 68%);
  filter:drop-shadow(0 0 38px rgba(0,255,140,0.13));
}
.lr-ring{ position:absolute; border:1px solid rgba(0,255,140,0.16); border-radius:50%; }
.lr-cross{ position:absolute; background:rgba(0,255,140,0.12); }
.lr-cross-h{ left:0; right:0; top:50%; height:1px; }
.lr-cross-v{ top:0; bottom:0; left:50%; width:1px; }
.lr-sweep{
  position:absolute; inset:0; border-radius:50%;
  background:conic-gradient(from 0deg,
    rgba(0,255,140,0) 0deg, rgba(0,255,140,0) 290deg,
    rgba(0,255,140,0.06) 340deg, rgba(0,255,140,0.5) 360deg);
  animation: lr-sweep 3.6s linear infinite;
}
@keyframes lr-sweep{ to{ transform:rotate(360deg); } }
.lr-blip{
  position:absolute; width:7px; height:7px; border-radius:50%;
  background:#7dffbd; box-shadow:0 0 12px rgba(0,255,140,0.9);
  animation: lr-blip 3.6s ease-out infinite;
}
@keyframes lr-blip{ 0%{opacity:0;transform:scale(.5)} 8%{opacity:1} 55%{opacity:0} 100%{opacity:0} }
.lr-scan{
  position:absolute; inset:0; pointer-events:none;
  background:repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.22) 3px);
  mix-blend-mode:multiply; opacity:.55;
}
.lr-vignette{ position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(circle at center, transparent 45%, rgba(0,0,0,0.82) 100%); }
@keyframes lr-flick{ 0%,100%{opacity:1} 92%{opacity:.98} 93%{opacity:.86} 94%{opacity:1} 97%{opacity:.93} 98%{opacity:1} }

.lr-term{
  position:relative; z-index:2; width:min(560px, 90vw);
  padding:26px 28px;
  background:rgba(3,12,9,0.72);
  border:1px solid rgba(0,255,140,0.28);
  box-shadow:0 0 0 1px rgba(0,0,0,0.5), 0 0 60px rgba(0,255,140,0.10), inset 0 0 40px rgba(0,255,140,0.04);
  backdrop-filter: blur(2px);
  font-size:13px; line-height:1.7; letter-spacing:.3px;
  text-shadow:0 0 8px rgba(0,255,140,0.35);
}
.lr-corner{ position:absolute; width:12px; height:12px; border:2px solid #2effa0; }
.lr-tl{ left:-1px; top:-1px; border-right:0; border-bottom:0; }
.lr-tr{ right:-1px; top:-1px; border-left:0; border-bottom:0; }
.lr-bl{ left:-1px; bottom:-1px; border-right:0; border-top:0; }
.lr-br{ right:-1px; bottom:-1px; border-left:0; border-top:0; }
.lr-line{ white-space:pre; opacity:0; animation: lr-in .25s ease-out forwards; }
@keyframes lr-in{ from{opacity:0; transform:translateY(2px)} to{opacity:.92} }
.lr-rule{ height:1px; margin:12px 0; background:linear-gradient(90deg, rgba(0,255,140,0.5), transparent); }

.lr-prompt{ display:flex; align-items:center; gap:10px; }
.lr-arrow{ color:#9affd0; white-space:nowrap; }
.lr-inputwrap{ position:relative; flex:1; }
.lr-input{
  position:absolute; inset:0; width:100%; height:100%;
  background:transparent; border:0; outline:0; color:transparent; caret-color:transparent;
  font:inherit; letter-spacing:.3px;
}
.lr-shadow{ pointer-events:none; color:#7dffbd; letter-spacing:3px; }
.lr-caret{ animation: lr-blink 1s steps(1) infinite; color:#7dffbd; }
@keyframes lr-blink{ 50%{ opacity:0; } }

.lr-status{ margin-top:14px; font-size:11px; letter-spacing:.4px; min-height:14px; }
.lr-hint{ color:#2c8f66; text-shadow:none; }
.lr-att{ color:#2c8f66; text-shadow:none; }
.lr-denied{ color:#ff5252; text-shadow:0 0 10px rgba(255,60,60,0.6); }
.lr-ok{ color:#7dffbd; }
.lr-grant-msg{ color:#9affd0; }

.lr-deny{ animation: lr-shake .5s; border-color:rgba(255,70,70,0.6); box-shadow:0 0 60px rgba(255,40,40,0.18); }
@keyframes lr-shake{
  10%,90%{ transform:translateX(-2px) } 20%,80%{ transform:translateX(3px) }
  30%,50%,70%{ transform:translateX(-6px) } 40%,60%{ transform:translateX(6px) }
}
.lr-grant{ border-color:rgba(0,255,140,0.6); box-shadow:0 0 80px rgba(0,255,140,0.22); }

@media (prefers-reduced-motion: reduce){
  .lr-sweep,.lr-blip,.lr-gate,.lr-caret{ animation:none !important; }
}
`;
