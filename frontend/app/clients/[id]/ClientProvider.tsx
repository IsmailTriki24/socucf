"use client";
import { createContext, useCallback, useContext } from "react";
import { get } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useWorkspace } from "@/lib/workspace";
import { Loading } from "@/components/ui/basics";
import type { ClientLite } from "@/lib/types";

type Ctx = { client: ClientLite; reload: () => Promise<void>; can: (p: string) => boolean };
const C = createContext<Ctx | null>(null);
export const useClient = () => useContext(C)!;

export default function ClientProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const r = useAsync(() => get<ClientLite>(`/clients/${id}`), [id]);
  const ws = useWorkspace();
  const reload = useCallback(async () => { await Promise.all([r.reload(), ws.reload()]); }, [r, ws]);
  if (r.error) return <Loading error={r.error} />;
  if (!r.data) return <Loading loading />;
  return <C.Provider value={{ client: r.data, reload, can: (p) => !!r.data!.permissions[p] }}>{children}</C.Provider>;
}
