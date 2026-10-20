"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { get, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errMsg, useAsync } from "@/lib/hooks";
import { ROLE_LABELS } from "@/lib/status";
import { relTime } from "@/lib/format";
import { Avatar, Button, Field, Input, Loading, Notice, PageHeader, Select, Switch } from "@/components/ui/basics";
import { Modal } from "@/components/ui/overlay";

type U = { id: number; username: string; first_name: string; last_name: string; email: string; role_global: string; is_active: boolean; last_login: string | null };

export default function Utilisateurs() {
  const { me } = useAuth();
  const users = useAsync(() => get<U[]>("/users"), []);
  const [edit, setEdit] = useState<(Partial<U> & { password?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  if (me && !me.is_platform_admin) return <Notice kind="err">Réservé à l&apos;Administrateur plateforme.</Notice>;

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { first_name: edit.first_name ?? "", last_name: edit.last_name ?? "", email: edit.email ?? "", role_global: edit.role_global ?? "", is_active: edit.is_active };
      if (edit.password) body.password = edit.password;
      if (edit.id) await patch(`/users/${edit.id}`, body); else await post("/users", { ...body, username: edit.username });
      toast.success("Utilisateur enregistré."); setEdit(null); users.reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <PageHeader title="Comptes utilisateurs" subtitle="Les rôles globaux se donnent ici. Les accès à un client se gèrent dans Utilisateurs et accès."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit({ username: "", role_global: "", is_active: true })}>Nouvel utilisateur</Button>} />
      <Loading error={users.error} loading={users.loading && !users.data} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {users.data?.map((u) => {
          const nom = `${u.first_name} ${u.last_name}`.trim() || u.username;
          return (
            <button key={u.id} onClick={() => setEdit({ ...u })} className="surface flex items-center gap-3.5 p-4 text-left transition-colors hover:border-accent/50">
              <Avatar name={nom} size={42} />
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{nom}</span><span className="mono block truncate text-[12.5px] text-fg-3">{u.username}</span>
                <span className="mt-1 block text-xs text-fg-3">{u.role_global ? <span className="text-accent">{ROLE_LABELS[u.role_global]}</span> : "Pas de rôle global"} · {u.last_login ? `vu ${relTime(u.last_login)}` : "jamais connecté"}</span></span>
              {!u.is_active && <span className="rounded bg-err/15 px-1.5 py-0.5 text-xs text-err">désactivé</span>}
            </button>
          );
        })}
      </div>
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? `Modifier ${edit.username}` : "Nouvel utilisateur"}
        footer={<><Button onClick={() => setEdit(null)}>Annuler</Button><Button variant="primary" loading={busy} disabled={!edit?.id && !edit?.username?.trim()} onClick={save}>Enregistrer</Button></>}>
        {edit && <div className="grid gap-4">
          {!edit.id && <Field label="Identifiant"><Input autoFocus value={edit.username ?? ""} onChange={(e) => setEdit({ ...edit, username: e.target.value })} autoComplete="off" /></Field>}
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Prénom"><Input value={edit.first_name ?? ""} onChange={(e) => setEdit({ ...edit, first_name: e.target.value })} /></Field><Field label="Nom"><Input value={edit.last_name ?? ""} onChange={(e) => setEdit({ ...edit, last_name: e.target.value })} /></Field></div>
          <Field label="E-mail"><Input type="email" value={edit.email ?? ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
          <Field label="Rôle global"><Select value={edit.role_global ?? ""} onChange={(e) => setEdit({ ...edit, role_global: e.target.value })}><option value="">Aucun</option><option value="responsable_catalogue">Responsable catalogue</option><option value="admin_plateforme">Administrateur plateforme</option></Select></Field>
          <Field label={edit.id ? "Nouveau mot de passe" : "Mot de passe"} hint={edit.id ? "12 caractères minimum. Laissez vide pour ne pas le changer." : "12 caractères minimum. Laissez vide si la connexion se fait par SSO."}><Input type="password" minLength={12} autoComplete="new-password" value={edit.password ?? ""} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
          <label className="flex items-center gap-3"><Switch label="Compte actif" checked={!!edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} />Compte actif</label>
        </div>}
      </Modal>
    </>
  );
}
