"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Plus, Search } from "lucide-react";
import { get } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import type { Tactique, Technique } from "@/lib/types";
import { Chip, EmptyState, Input } from "../ui/basics";
import { Tip } from "../ui/overlay";

export default function TechniquePicker({ techniques, tactiques, editable, onChange }: { techniques: Technique[]; tactiques: Tactique[]; editable: boolean; onChange: (identifiants: string[]) => Promise<void> | void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 200);
  const [found, setFound] = useState<Technique[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const tac = (s: string) => tactiques.find((t) => t.shortname === s)?.nom ?? s;
  const have = new Set(techniques.map((t) => t.identifiant));

  useEffect(() => {
    if (dq.trim().length < 2) { setFound([]); return; }
    let live = true;
    get<Technique[]>(`/techniques?actives=1&q=${encodeURIComponent(dq.trim())}`).then((r) => live && setFound(r)).catch(() => live && setFound([]));
    return () => { live = false; };
  }, [dq]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="grid gap-4">
      {editable && (
        <div ref={box} className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-fg-3" />
          <Input className="pl-9" value={q} placeholder="Chercher une technique : T1110, force brute, PowerShell…" aria-label="Chercher une technique ATT&CK" onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
          {open && dq.trim().length >= 2 && (
            <ul className="scroll-thin absolute z-30 mt-1.5 max-h-80 w-full overflow-y-auto rounded-lg border border-line bg-panel p-1 shadow-[var(--shadow-pop)]">
              {found.map((t) => (
                <li key={t.id}>
                  <button type="button" disabled={have.has(t.identifiant)} onClick={async () => { await onChange([...have, t.identifiant]); setQ(""); setOpen(false); }}
                    className="flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left hover:bg-panel-2 disabled:opacity-40">
                    <span className="mono mt-0.5 w-20 shrink-0 text-[12.5px] text-accent">{t.identifiant}</span>
                    <span className="min-w-0 flex-1"><span className="block text-[13.5px]">{t.nom}</span><span className="block truncate text-xs text-fg-3">{t.tactiques.map(tac).join(", ")}</span></span>
                    {have.has(t.identifiant) ? <span className="text-xs text-fg-3">déjà liée</span> : <Plus className="mt-1 size-4 text-fg-3" />}
                  </button>
                </li>
              ))}
              {!found.length && <li className="px-3 py-4 text-center text-[13px] text-fg-3">Aucune technique trouvée.</li>}
            </ul>
          )}
        </div>
      )}
      {techniques.length === 0 ? (
        <EmptyState title="Aucune technique ATT&CK liée">{editable ? "Cherchez une technique ci-dessus pour la lier à cette détection." : "Cette détection n'est liée à aucune technique."}</EmptyState>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {techniques.map((t) => (
            <li key={t.id} className="surface flex items-start gap-3 px-4 py-3">
              <span className="mono mt-0.5 text-[13px] font-medium text-accent">{t.identifiant}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{t.nom}</p>
                <p className="mt-1 flex flex-wrap gap-1">{t.tactiques.map((s) => <Chip key={s}>{tac(s)}</Chip>)}</p>
                {(!t.verifiee || t.revoquee || t.obsolete) && <Tip label="Cette technique est inconnue, révoquée ou obsolète dans le référentiel ATT&CK chargé."><p className="mt-1.5 inline-flex items-center gap-1 text-xs text-warn"><AlertTriangle className="size-3.5" />{t.revoquee ? "Révoquée" : t.obsolete ? "Obsolète" : "Non vérifiée"}</p></Tip>}
              </div>
              {editable && <button type="button" aria-label={`Retirer ${t.identifiant}`} className="text-fg-3 hover:text-err" onClick={() => onChange([...have].filter((x) => x !== t.identifiant))}>×</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
