"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { get } from "./api";
import { useAuth } from "./auth";
import type { ClientLite } from "./types";

type Ctx = {
  clients: ClientLite[] | null;       // null tant que la liste n'est pas chargée
  current: ClientLite | null;         // client actif : celui de l'URL, sinon le dernier utilisé, sinon le premier
  reload: () => Promise<void>;
  remember: (id: number) => void;
};
const WorkspaceCtx = createContext<Ctx>({ clients: null, current: null, reload: async () => {}, remember: () => {} });
const KEY = "socusf.client";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { me } = useAuth();
  const path = usePathname();
  const [clients, setClients] = useState<ClientLite[] | null>(null);
  const [last, setLast] = useState<number | null>(null);

  const reload = useCallback(async () => {
    try { setClients(await get<ClientLite[]>("/clients")); } catch { setClients([]); }
  }, []);
  useEffect(() => { if (me) reload(); else setClients(null); }, [me, reload]);
  useEffect(() => { try { const v = localStorage.getItem(KEY); if (v) setLast(Number(v)); } catch { /* stockage indisponible */ } }, []);

  const remember = useCallback((id: number) => {
    setLast(id);
    try { localStorage.setItem(KEY, String(id)); } catch { /* stockage indisponible */ }
  }, []);

  const urlId = /^\/clients\/(\d+)/.exec(path)?.[1];
  const current = useMemo(() => {
    if (!clients?.length) return null;
    return clients.find((c) => c.id === Number(urlId)) ?? clients.find((c) => c.id === last) ?? clients[0];
  }, [clients, urlId, last]);

  useEffect(() => { if (urlId && clients?.some((c) => c.id === Number(urlId))) remember(Number(urlId)); }, [urlId, clients, remember]);

  return <WorkspaceCtx.Provider value={{ clients, current, reload, remember }}>{children}</WorkspaceCtx.Provider>;
}

export const useWorkspace = () => useContext(WorkspaceCtx);
