export type StatutId = "brouillon" | "en_test" | "a_revoir" | "validee" | "deployee";

export const STATUTS: { id: StatutId; label: string; desc: string }[] = [
  { id: "brouillon", label: "Brouillon", desc: "En préparation, pas encore testée" },
  { id: "en_test", label: "En test", desc: "Règle écrite, test en cours" },
  { id: "a_revoir", label: "À revoir", desc: "Faux positifs ou réglages à reprendre" },
  { id: "validee", label: "Validé", desc: "Testée et approuvée, prête à déployer" },
  { id: "deployee", label: "Déployé", desc: "Active dans le SIEM du client" },
];
export const STATUT_LABEL: Record<string, string> = Object.fromEntries(STATUTS.map((s) => [s.id, s.label]));
export const statutColor = (s: string) => `var(--st-${s})`;

export const GRAVITES = ["Critique", "Haute", "Moyenne", "Basse"] as const;
export const GRAVITE_LEVEL: Record<string, number> = { Critique: 4, Haute: 3, Moyenne: 2, Basse: 1 };
export const graviteColor = (g: string) => `var(--sev-${g.toLowerCase()})`;
export const TYPES = ["Simple", "Seuil", "Corrélation"] as const;

export const ROLE_LABELS: Record<string, string> = {
  admin_plateforme: "Administrateur plateforme", responsable_catalogue: "Responsable catalogue",
  admin_client: "Admin client", valideur: "Valideur", contributeur: "Contributeur", lecteur: "Lecteur",
};
export const ROLES_CLIENT = ["admin_client", "valideur", "contributeur", "lecteur"] as const;
export const CATEGORIE_LABEL: Record<string, string> = { siem: "SIEM", xdr: "XDR / plateforme SOC", ndr: "NDR / réseau", generique: "Format générique" };
