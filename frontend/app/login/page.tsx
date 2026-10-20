"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radar } from "lucide-react";
import { post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errMsg } from "@/lib/hooks";
import { STATUTS } from "@/lib/status";
import { Button, Field, Input, Notice } from "@/components/ui/basics";
import { ReadinessStrip } from "@/components/domain/marks";

const DEMO = Array.from({ length: 64 }, (_, i) => ({ statut: STATUTS[Math.min(4, Math.floor(((i * 7919) % 100) / 22))].id }));

export default function Login() {
  const { refresh, oidc } = useAuth();
  const router = useRouter();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await post("/auth/login", { username, password });
      await refresh();
      router.replace("/");
    } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line-soft bg-bg-2 p-12 lg:flex">
        <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-ink"><Radar className="size-5" strokeWidth={2.4} /></span><span className="text-lg font-bold">SOC UCF</span></div>
        <div className="max-w-lg">
          <h1 className="text-[44px] leading-[1.05]">Chaque détection du client, de l&apos;idée au déploiement.</h1>
          <p className="mt-4 text-[16px] text-fg-3">Règles par SIEM et XDR, journalisation, exclusions, couverture MITRE ATT&CK : un seul espace par client.</p>
          <div className="mt-10"><ReadinessStrip items={DEMO} height={34} /></div>
        </div>
        <p className="text-[13px] text-fg-3">UC Factory SOC</p>
      </div>
      <div className="grid place-items-center p-8">
        <form onSubmit={submit} className="grid w-full max-w-sm gap-5">
          <div><h2 className="text-2xl">Connexion</h2><p className="mt-1 text-fg-3">Accédez à votre espace de travail.</p></div>
          {err && <Notice kind="err">{err}</Notice>}
          {oidc && <a className="inline-flex h-11 items-center justify-center rounded-md bg-accent font-semibold text-accent-ink hover:bg-accent-hover" href="/api/oidc/authenticate/">Se connecter avec le SSO</a>}
          <Field label={oidc ? "Compte de secours (Administrateur plateforme)" : "Identifiant"}><Input value={username} onChange={(e) => setU(e.target.value)} autoComplete="username" required autoFocus className="h-11" /></Field>
          <Field label="Mot de passe"><Input type="password" value={password} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required className="h-11" /></Field>
          <Button variant="primary" size="lg" loading={busy}>Se connecter</Button>
        </form>
      </div>
    </div>
  );
}
