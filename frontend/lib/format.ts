export function fmtDate(s?: string | null, withTime = false) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("fr-FR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "medium" });
}

export function relTime(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s).getTime();
  if (isNaN(d)) return s;
  const sec = Math.round((Date.now() - d) / 1000);
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [[60, "second"], [3600, "minute"], [86400, "hour"], [2592000, "day"], [31536000, "month"]];
  let div = 1;
  for (const [limit, unit] of steps) {
    if (Math.abs(sec) < limit) return rtf.format(-Math.round(sec / div), unit);
    div = limit;
  }
  return rtf.format(-Math.round(sec / 31536000), "year");
}

export function initials(name: string) {
  const p = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[1][0]).toUpperCase();
}

/** Teinte stable (0-359) dérivée d'un texte : chaque client a « sa » couleur. */
export function hue(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export const plural = (n: number, one: string, many?: string) => `${n} ${n > 1 ? many ?? one + "s" : one}`;
