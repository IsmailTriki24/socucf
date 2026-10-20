"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { get, qs } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { fmtDate, relTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar, Button, EmptyState, Input, Loading, Select } from "./ui/basics";

type Entry = { id: number; date: string; utilisateur: string; client: string; objet_type: string; objet: string; action: string; avant: Record<string, unknown> | null; apres: Record<string, unknown> | null };

const VERB: Record<string, string> = { creation: "a créé", modification: "a modifié", suppression: "a supprimé" };
const TYPES: Record<string, string> = {
  "clients.DetectionClient": "Détection", "clients.Client": "Client", "clients.ClientSource": "Source du client", "clients.DetectionSource": "Source d'une détection",
  "clients.PreuveTest": "Test", "catalog.Syntaxe": "Règle", "catalog.RequeteHunting": "Hunting", "catalog.Template": "Template", "catalog.TemplateSource": "Source d'un template",
  "catalog.Siem": "Plateforme", "catalog.Domaine": "Domaine", "catalog.SourceLog": "Source de logs", "accounts.Habilitation": "Accès", "accounts.User": "Utilisateur",
};
const short = (v: unknown) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s === undefined ? "∅" : s.length > 90 ? s.slice(0, 90) + "…" : s || "(vide)"; };

function Changes({ e }: { e: Entry }) {
  const keys = [...new Set([...Object.keys(e.avant ?? {}), ...Object.keys(e.apres ?? {})])].filter((k) => !["mis_a_jour_le", "modifie_le", "id"].includes(k));
  if (!keys.length) return <p className="text-[13px] text-fg-3">Aucun détail.</p>;
  return (
    <dl className="grid gap-1.5 text-[13px]">
      {keys.slice(0, 14).map((k) => (
        <div key={k} className="grid gap-x-3 sm:grid-cols-[170px_1fr]">
          <dt className="mono truncate text-fg-3">{k}</dt>
          <dd className="min-w-0 break-words">
            {e.action === "modification" && e.avant && <><span className="diff-del rounded px-1 line-through decoration-err/50">{short(e.avant[k])}</span> <span className="text-fg-3">→</span> </>}
            {e.apres && <span className={cn(e.action === "modification" && "diff-add rounded px-1")}>{short(e.apres[k])}</span>}
            {!e.apres && e.avant && <span className="diff-del rounded px-1">{short(e.avant[k])}</span>}
          </dd>
        </div>
      ))}
      {keys.length > 14 && <p className="text-fg-3">… et {keys.length - 14} autres champs</p>}
    </dl>
  );
}

export default function AuditTable({ path, showClient }: { path: string; showClient?: boolean }) {
  const [f, setF] = useState({ utilisateur: "", objet_type: "", action: "", q: "" });
  const [limit, setLimit] = useState(40);
  const [open, setOpen] = useState<number | null>(null);
  const r = useAsync(() => get<{ total: number; resultats: Entry[] }>(`${path}${qs({ ...f, limit })}`), [path, f.utilisateur, f.objet_type, f.action, f.q, limit]);
  const upd = (k: string, v: string) => { setLimit(40); setF({ ...f, [k]: v }); };
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="w-48" placeholder="Utilisateur" value={f.utilisateur} onChange={(e) => upd("utilisateur", e.target.value)} aria-label="Utilisateur" />
        <Input className="w-56" placeholder="Objet (DET-001…)" value={f.q} onChange={(e) => upd("q", e.target.value)} aria-label="Objet" />
        <Select className="w-52" value={f.objet_type} onChange={(e) => upd("objet_type", e.target.value)} aria-label="Type d'objet"><option value="">Tous les types</option>{Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <Select className="w-44" value={f.action} onChange={(e) => upd("action", e.target.value)} aria-label="Action"><option value="">Toutes les actions</option><option value="creation">Créations</option><option value="modification">Modifications</option><option value="suppression">Suppressions</option></Select>
      </div>
      <Loading error={r.error} loading={r.loading && !r.data} />
      {r.data && (
        <>
          {r.data.resultats.length === 0 && <EmptyState title="Aucune entrée">Aucune écriture ne correspond à ces filtres.</EmptyState>}
          <ol className="surface divide-y divide-line-soft overflow-hidden">
            {r.data.resultats.map((e) => (
              <li key={e.id}>
                <button className="flex w-full items-center gap-3.5 px-4 py-3 text-left hover:bg-panel-2/60" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                  <Avatar name={e.utilisateur} size={30} />
                  <span className="min-w-0 flex-1 truncate"><b className="font-medium">{e.utilisateur}</b> <span className="text-fg-3">{VERB[e.action] ?? e.action}</span> <span className="text-fg-2">{TYPES[e.objet_type] ?? e.objet_type}</span> <span className="mono text-[13px]">{e.objet.replace(/^.* · /, "")}</span>{showClient && e.client && <span className="text-fg-3"> chez {e.client}</span>}</span>
                  <time className="shrink-0 text-[13px] text-fg-3" title={fmtDate(e.date, true)}>{relTime(e.date)}</time>
                  <ChevronDown className={cn("size-4 shrink-0 text-fg-3 transition-transform", open === e.id && "rotate-180")} />
                </button>
                {open === e.id && <div className="border-t border-line-soft bg-bg-2/50 px-5 py-4"><Changes e={e} /></div>}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center justify-between text-[13px] text-fg-3"><span>{r.data.resultats.length} sur {r.data.total} entrée(s)</span>{r.data.resultats.length < r.data.total && <Button onClick={() => setLimit(limit + 40)}>Charger plus</Button>}</div>
        </>
      )}
    </>
  );
}
