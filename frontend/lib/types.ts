import type { StatutId } from "./status";

export type Habilitation = { client_id: number; client_nom: string; role: string };
export type Me = {
  id: number; username: string; nom: string; email: string; role_global: string;
  is_platform_admin: boolean; is_catalogue_manager: boolean; habilitations: Habilitation[];
};
export type Siem = { id: number; code: string; nom: string; categorie: string; langage_regle: string; langage_hunting: string; mode_editeur: string; ordre: number; nb_clients?: number };
export type SiemLite = { id: number; code: string; nom: string; categorie: string; mode_editeur: string };
export type Domaine = { id: number; nom: string; ordre: number; nb_templates?: number };
export type SourceLog = { id: number; nom: string; a_activer: string; evenements_cles: string; piege: string; nb_cas_usage?: number };
export type Tactique = { shortname: string; nom: string; ordre: number };
export type Technique = { id: number; identifiant: string; nom: string; tactiques: string[]; verifiee: boolean; revoquee?: boolean; obsolete?: boolean };

export type ClientLite = {
  id: number; nom: string; secteur: string; actif: boolean; siems: SiemLite[]; domaines: { id: number; nom: string }[];
  permissions: Record<string, boolean>; nb_detections?: number; par_statut?: Record<StatutId, number>; journalisation_ok?: number; bande?: StatutId[];
};

export type DetectionItem = {
  id: number; code: string; domaine: string; domaine_id: number; cas_usage: string; type_detection: string; gravite: string;
  statut: StatutId; journalisation: "ok" | "non"; techniques: string[]; tactiques: string[]; siems_regle: string[];
  sources: { source_id: number; nom: string; collectee: boolean }[]; proprietaire: string | null;
  a_exclusions: boolean; a_recommandation: boolean; a_impact: boolean; libre: boolean; modifie_le: string | null; date_deploiement: string | null;
};

export type SyntaxeEntry = {
  id: number | null; siem: string; siem_nom: string; mode_editeur: string; langage?: string; contenu: string; rendu?: string;
  parametres_non_resolus?: string[]; champs_requis: string[]; notes: string; presente?: boolean;
};
export type HuntingEntry = { id: number; siem: string; siem_nom?: string; titre: string; objectif: string; requete: string; rendu?: string; periode_conseillee: string };
export type SourceEntry = {
  source_id: number; nom: string; obligatoire: boolean; collectee?: boolean; statut?: string;
  a_activer: string; evenements_cles: string; piege: string;
};
export type Preuve = { id: number; date: string; resultat: "reussi" | "echoue"; description: string; capture: boolean; auteur: string | null };

export type DetectionFull = {
  id: number; client_id: number; client_nom: string; code: string; libre: boolean; template_code: string | null;
  domaine: string; domaine_id: number; cas_usage: string; type_detection: string; gravite: string; statut: StatutId; journalisation: "ok" | "non";
  detections_similaires: string; logs_a_collecter: string; logique: string; exclusions: string; recommandation: string; impact: string; notes: string;
  parametres: Record<string, string | number>; parametres_effectifs: Record<string, string | number>; listes_reference: Record<string, string[]>;
  parametres_template: Record<string, string | number>;
  sources: SourceEntry[]; techniques: Technique[]; proprietaire: string | null; proprietaire_id: number | null;
  date_deploiement: string | null; reference_siem: string; modifie_par: string | null; modifie_le: string | null;
  syntaxes: SyntaxeEntry[]; hunting: HuntingEntry[]; preuves: Preuve[]; permissions: Record<string, boolean>;
};

export type TemplateItem = {
  code: string; domaine: string; domaine_id: number; cas_usage: string; type_detection: string; gravite: string;
  sources: string[]; techniques: string[]; tactiques: string[]; siems_regle: string[]; nb_hunting: number;
  a_exclusions: boolean; a_recommandation: boolean; a_impact: boolean; nb_clients?: number;
};
export type TemplateFull = {
  code: string; domaine: string; domaine_id: number; cas_usage: string; type_detection: string; gravite: string;
  detections_similaires: string; logs_a_collecter: string; logique: string; parametres_defaut: Record<string, string | number>;
  exclusions: string; recommandation: string; impact: string; sources: SourceEntry[]; techniques: Technique[];
  syntaxes: { id: number; siem: string; contenu: string; champs_requis: string[]; notes: string }[];
  hunting: { id: number; siem: string; titre: string; objectif: string; requete: string; periode_conseillee: string }[];
  modifie_le: string; peut_modifier: boolean; nb_clients?: number;
};

export type MatrixCell = { id: string; nom: string; count: number; detections: string[]; statut: string | null; verifiee?: boolean;
  sous_techniques: { id: string; nom: string; count: number; detections: string[]; statut: string | null }[] };
export type MatrixData = { tactiques: { shortname: string; nom: string; techniques: MatrixCell[] }[]; referentiel_charge: boolean; nb_techniques_couvertes: number };
