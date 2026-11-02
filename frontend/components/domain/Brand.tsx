"use client";
import { useId } from "react";
import { cn } from "@/lib/cn";

/* Identité : logo du Tunisian Financial Cert redessiné en vectoriel (net à toute taille, couleur suivant le thème
   via --brand-ink) et chat cyber, la mascotte de la plateforme (même famille que le chat de la page de connexion),
   placé à droite du logo. Le PDF n'utilise que le logo (backend/clients/pdf/logo.svg) ; le chat sert aussi d'icône d'onglet. */

export function CertSymbol({ height = 32, className }: { height?: number; className?: string }) {
  return (
    <svg viewBox="0 0 37 36" height={height} width={(height * 37) / 36} className={cn("shrink-0", className)} aria-hidden>
      <path d="M0 6H20V12H6V30H25V17H31V36H0Z" fill="var(--brand-ink)" />
      <path d="M19 0H37V17H31V6H19Z" fill="var(--brand-cyan)" />
    </svg>
  );
}

export function CertLogo({ height = 32, className }: { height?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap: height * 0.32 }} role="img" aria-label="Tunisian Financial Cert">
      <CertSymbol height={height} />
      <span className="leading-[1.04]" style={{ color: "var(--brand-ink)" }} aria-hidden>
        <span className="block font-bold tracking-[-0.015em]" style={{ fontSize: height * 0.56 }}>Tunisian</span>
        <span className="block font-medium" style={{ fontSize: height * 0.42 }}>Financial Cert</span>
      </span>
    </span>
  );
}

export function CatHead({ size = 32, blink, className }: { size?: number; blink?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cn("shrink-0", blink && "cm-blink", className)} role="img" aria-label="Chat cyber, mascotte de la plateforme">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8e9bff" /><stop offset="1" stopColor="#5d69e6" /></linearGradient>
        <radialGradient id={`${id}i`} cx=".5" cy=".45" r=".6"><stop offset="0" stopColor="#d9fbff" /><stop offset=".45" stopColor="#4fd6f2" /><stop offset="1" stopColor="#1aa3cc" /></radialGradient>
      </defs>
      <g strokeLinejoin="round">
        <path d="M12.5 31 9 7.5 28.5 19.5Z" fill={`url(#${id}f)`} stroke="#5d69e6" strokeWidth="2.4" />
        <path d="M51.5 31 55 7.5 35.5 19.5Z" fill={`url(#${id}f)`} stroke="#5d69e6" strokeWidth="2.4" />
        <path d="M15.5 25 13.5 13.5 23.5 19.8Z" fill="#1aa3cc" stroke="#1aa3cc" strokeWidth="1.6" />
        <path d="M48.5 25 50.5 13.5 40.5 19.8Z" fill="#1aa3cc" stroke="#1aa3cc" strokeWidth="1.6" />
      </g>
      <ellipse cx="32" cy="36.5" rx="23" ry="19" fill={`url(#${id}f)`} />
      {/* Circuit sur le front */}
      <g stroke="#26307a" strokeWidth="2" strokeLinecap="round" fill="none"><path d="M32 18.5v8" /><path d="M27 20.5v2.5l-2.5 2.5" /><path d="M37 20.5v2.5l2.5 2.5" /></g>
      <g fill="#26307a"><circle cx="24.3" cy="25.8" r="1.5" /><circle cx="39.7" cy="25.8" r="1.5" /><circle cx="32" cy="27.5" r="1.5" /></g>
      {/* Visière et yeux lumineux */}
      <rect x="13" y="30" width="38" height="13" rx="6.5" fill="#0f1533" />
      <g className="cm-eyes">
        <ellipse cx="23.5" cy="36.5" rx="5.2" ry="4.6" fill={`url(#${id}i)`} />
        <ellipse cx="40.5" cy="36.5" rx="5.2" ry="4.6" fill={`url(#${id}i)`} />
        <rect x="22.6" y="32.6" width="1.8" height="7.8" rx=".9" fill="#0f1533" />
        <rect x="39.6" y="32.6" width="1.8" height="7.8" rx=".9" fill="#0f1533" />
      </g>
      <path d="M29.6 45.5h4.8l-2.4 2.6z" fill="#ff8fb8" stroke="#ff8fb8" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M32 48.2v1.6m0 0q-2.6 2.6-5 .8m5-.8q2.6 2.6 5 .8" stroke="#26307a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <g stroke="#c9d0ff" strokeWidth="1.3" strokeLinecap="round" opacity=".9"><path d="M20 47 9.5 45.5M20 50l-10 2.5" /><path d="M44 47l10.5-1.5M44 50l10 2.5" /></g>
    </svg>
  );
}

/** Logo du Cert, filet, puis la tête du chat cyber (la mascotte) suivie du nom de la plateforme. */
export function BrandLockup({ height = 30, className }: { height?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap: height * 0.4 }}>
      <CertLogo height={height} />
      <span className="self-stretch bg-[var(--brand-ink)] opacity-25" style={{ width: 1, margin: `${height * 0.05}px 0` }} aria-hidden />
      <span className="inline-flex items-center" style={{ gap: height * 0.2 }}>
        <CatHead size={height * 1.18} blink />
        <span className="whitespace-nowrap font-bold tracking-[-0.01em]" style={{ fontSize: height * 0.5, color: "var(--brand-ink)" }}>SOC UCF</span>
      </span>
    </span>
  );
}
