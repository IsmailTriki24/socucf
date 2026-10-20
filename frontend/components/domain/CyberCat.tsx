"use client";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";

const FUR = "#7584f2", FUR_DARK = "#4553c9", FUR_LIGHT = "#e3e7ff", PINK = "#ff9ec4", INK = "#0f1533", GEAR = "#1c2650";

const VB_W = 480, VB_H = 340, EYES = { x: 240, y: 116 }, REACH = { x: 5, y: 4 }, FULL_AT = 260;

/** Un chat cyber tout doux : il veille derrière son portable pendant que le radar balaie. Animations CSS dans globals.css (.cc-*). */
export function CyberCat({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null), look = useRef<SVGGElement>(null);

  // Les yeux suivent le pointeur ; hors de la fenêtre (ou si l'utilisateur limite les animations), le regard libre prend le relais.
  useEffect(() => {
    const root = svg.current, eyes = look.current;
    if (!root || !eyes || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const idle = () => { root.removeAttribute("data-follow"); eyes.style.transform = ""; };
    const move = (e: PointerEvent) => {
      const r = root.getBoundingClientRect(), s = Math.min(r.width / VB_W, r.height / VB_H);
      if (!s) return;
      const dx = e.clientX - (r.left + (r.width - VB_W * s) / 2 + EYES.x * s), dy = e.clientY - (r.top + (r.height - VB_H * s) / 2 + EYES.y * s);
      const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / FULL_AT);
      root.setAttribute("data-follow", "");
      eyes.style.transform = `translate(${((dx / d) * k * REACH.x).toFixed(2)}px, ${((dy / d) * k * REACH.y).toFixed(2)}px)`;
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", idle);
    return () => { window.removeEventListener("pointermove", move); document.documentElement.removeEventListener("pointerleave", idle); };
  }, []);

  const eye = (cx: number) => (
    <g transform={`translate(${cx} 116)`}>
      <g className="cc-eye">
        <ellipse rx="14" ry="17" fill={INK} />
        <ellipse cy="7" rx="11" ry="8" fill="var(--info)" opacity=".5" />
        <circle cx="-4.5" cy="-6" r="5.2" fill="#fff" />
        <circle cx="4.5" cy="5" r="2.3" fill="#fff" />
      </g>
    </g>
  );
  return (
    <svg ref={svg} viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label="Illustration : un chat de la cybersécurité qui veille derrière son ordinateur portable" className={cn("cc", className)} preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={`${id}g`}><stop offset="0" stopColor="var(--accent)" stopOpacity=".3" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8e9bff" /><stop offset="1" stopColor={FUR} /></linearGradient>
      </defs>

      <circle cx="240" cy="140" r="170" fill={`url(#${id}g)`} />
      {[0, -1.6, -3.2].map((d) => <circle key={d} className="cc-ring" cx="240" cy="172" r="60" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ animationDelay: `${d}s` }} />)}

      {/* Bits qui montent le long de l'écran */}
      {[["1", 30, 0, "--ok"], ["0", 58, -2.4, "--info"], ["1", 90, -4.2, "--ok"], ["0", 402, -1.2, "--info"], ["1", 432, -3.3, "--ok"], ["0", 462, -5, "--info"]].map(([t, x, d, c]) => (
        <text key={x as number} className="cc-bit mono" x={x as number} y="296" fontSize="15" fontWeight="700" fill={`var(${c})`} style={{ animationDelay: `${d}s` }}>{t}</text>
      ))}

      {/* Étincelles */}
      {[[118, 52, "--accent"], [26, 196, "--ok"], [452, 176, "--accent"], [330, 28, "--ok"], [74, 300, "--info"]].map(([x, y, c], i) => (
        <g key={i} transform={`translate(${x} ${y})`}><path className="cc-spark" d="M0 -6V6M-6 0H6" stroke={`var(${c})`} strokeWidth="2.5" strokeLinecap="round" style={{ animationDelay: `${-i * 0.9}s` }} /></g>
      ))}

      {/* Cadenas souriant */}
      <g className="cc-bob">
        <path d="M55 108V98a11 11 0 0 1 22 0v10" fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" />
        <rect x="48" y="108" width="36" height="28" rx="8" fill="var(--panel-2)" stroke="var(--accent)" strokeWidth="2.5" />
        <circle cx="60" cy="120" r="2.2" fill="var(--fg)" /><circle cx="72" cy="120" r="2.2" fill="var(--fg)" />
        <path d="M61 126q5 4.5 10 0" fill="none" stroke="var(--fg)" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Fenêtre de terminal */}
      <g className="cc-bob" style={{ animationDelay: "-2s" }}>
        <rect x="352" y="36" width="100" height="64" rx="9" fill="var(--panel-2)" stroke="var(--line)" strokeWidth="2" />
        <circle cx="365" cy="47" r="2.6" fill="var(--err)" /><circle cx="374" cy="47" r="2.6" fill="var(--warn)" /><circle cx="383" cy="47" r="2.6" fill="var(--ok)" />
        <rect className="cc-line" x="362" y="58" width="62" height="5" rx="2.5" fill="var(--ok)" />
        <rect className="cc-line" x="362" y="69" width="44" height="5" rx="2.5" fill="var(--info)" style={{ animationDelay: ".6s" }} />
        <text className="mono" x="362" y="90" fontSize="11" fontWeight="700" fill="var(--accent)">&gt;</text>
        <rect className="cc-cursor" x="374" y="82" width="7" height="10" rx="1.5" fill="var(--accent)" />
      </g>

      {/* Queue (derrière le portable) */}
      <g className="cc-tail" fill="none">
        <path d="M370 292C424 296 436 238 410 206C400 192 414 180 428 188" stroke={FUR} strokeWidth="16" strokeLinecap="round" />
        <path d="M370 292C424 296 436 238 410 206C400 192 414 180 428 188" stroke={FUR_DARK} strokeWidth="16" strokeDasharray="7 21" opacity=".5" />
        <circle cx="428" cy="188" r="8" fill={FUR_LIGHT} stroke="none" />
      </g>

      {/* Oreilles */}
      <g strokeLinejoin="round">
        <g className="cc-ear-l"><polygon points="168,96 158,44 214,72" fill={FUR} stroke={FUR} strokeWidth="10" /><polygon points="172,84 168,58 196,74" fill={PINK} stroke={PINK} strokeWidth="4" /></g>
        <g className="cc-ear-r"><polygon points="312,96 322,44 266,72" fill={FUR} stroke={FUR} strokeWidth="10" /><polygon points="308,84 312,58 284,74" fill={PINK} stroke={PINK} strokeWidth="4" /></g>
      </g>

      {/* Tête */}
      <ellipse cx="240" cy="125" rx="78" ry="60" fill={`url(#${id}f)`} />
      <path d="M232 70v10M240 67v14M248 70v10" stroke={FUR_DARK} strokeWidth="4" strokeLinecap="round" opacity=".8" />
      <ellipse cx="240" cy="147" rx="27" ry="17" fill={FUR_LIGHT} />
      <ellipse cx="188" cy="140" rx="11" ry="7" fill="#ff8fb8" opacity=".5" /><ellipse cx="292" cy="140" rx="11" ry="7" fill="#ff8fb8" opacity=".5" />

      {/* Moustaches */}
      <g stroke="var(--fg-2)" strokeWidth="2" strokeLinecap="round" opacity=".7">
        <g className="cc-whisk-l"><path d="M202 140L146 130M202 147L144 148M202 154L148 166" /></g>
        <g className="cc-whisk-r"><path d="M278 140L334 130M278 147L336 148M278 154L332 166" /></g>
      </g>

      {/* Casque-micro */}
      <path d="M316 142Q318 166 272 158" fill="none" stroke={GEAR} strokeWidth="4" strokeLinecap="round" />
      <circle cx="270" cy="158" r="5" fill="var(--accent)" />
      {[154, 304].map((x) => <rect key={x} x={x} y="106" width="22" height="38" rx="10" fill={GEAR} stroke="var(--accent)" strokeWidth="2.5" />)}
      {[165, 315].map((x) => <circle key={x} className="cc-led" cx={x} cy="125" r="3.5" fill="var(--info)" />)}

      {/* Visage */}
      <g ref={look} className="cc-look">{eye(207)}{eye(273)}</g>
      <path d="M233 134Q240 131 247 134Q244 142 240 143Q236 142 233 134Z" fill="#ff7fb0" stroke="#ff7fb0" strokeWidth="2" strokeLinejoin="round" />
      <path d="M240 143v5M240 148q-6 7-12 2M240 148q6 7 12 2" fill="none" stroke="#3b2a63" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Portable : on le voit de dos, avec son bouclier */}
      <rect x="100" y="172" width="280" height="130" rx="14" fill="var(--panel-2)" stroke="var(--line)" strokeWidth="2.5" />
      <g className="cc-shield">
        <path d="M240 204L272 216V240Q272 260 240 272Q208 260 208 240V216Z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="3.5" strokeLinejoin="round" />
        <path className="cc-check" d="M226 238L236 248L256 226" pathLength="1" fill="none" stroke="var(--ok)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g fill="var(--fg-3)" opacity=".6">
        <ellipse cx="136" cy="280" rx="7.5" ry="6" /><circle cx="128" cy="270" r="2.6" /><circle cx="134" cy="266" r="2.6" /><circle cx="141" cy="266" r="2.6" /><circle cx="147" cy="270" r="2.6" />
      </g>
      <text className="mono" x="322" y="284" fontSize="17" fontWeight="700" fill="var(--fg-3)" opacity=".6">&lt;/&gt;</text>
      <rect x="84" y="300" width="312" height="12" rx="6" fill="var(--panel-3)" stroke="var(--line)" strokeWidth="2" />
      <ellipse cx="240" cy="324" rx="150" ry="6" fill="#000" opacity=".14" />

      {/* Pattes qui tapent sur le capot */}
      {[[200, "cc-paw-l"], [280, "cc-paw-r"]].map(([x, c]) => (
        <g key={c as string} className={c as string}>
          <ellipse cx={x as number} cy="174" rx="21" ry="14" fill={FUR} stroke={FUR_DARK} strokeWidth="2" />
          <path d={`M${(x as number) - 6} 171v5M${x} 170v6M${(x as number) + 6} 171v5`} stroke={FUR_DARK} strokeWidth="2" strokeLinecap="round" opacity=".7" />
        </g>
      ))}
    </svg>
  );
}
