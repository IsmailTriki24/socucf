"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ensureCsrf, get, post } from "./api";
import type { Me } from "./types";

type Ctx = { me: Me | null; loading: boolean; oidc: boolean; refresh: () => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx>({ me: null, loading: true, oidc: false, refresh: async () => {}, logout: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [oidc, setOidc] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setMe(await get<Me>("/auth/me"));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    ensureCsrf().then((r) => setOidc(!!r?.oidc));
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await post("/auth/logout");
    setMe(null);
    location.href = "/login";
  }, []);

  return <AuthCtx.Provider value={{ me, loading, oidc, refresh, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
