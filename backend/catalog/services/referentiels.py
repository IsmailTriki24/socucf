from ..models import Siem

# (code, nom, catégorie, langage de règle, langage de hunting, mode éditeur)
# Les cinq premiers viennent du fichier Excel v1.0 ; les autres sont des plateformes SIEM / XDR courantes.
# Tout se modifie ensuite depuis l'application (Référentiels > Plateformes).
SIEMS = [
    ("wazuh", "Wazuh", "siem", "XML Wazuh (règles locales)", "DQL / Lucene (Discover)", "xml"),
    ("splunk", "Splunk (Cisco)", "siem", "SPL (recherche planifiée)", "SPL", "sql"),
    ("sentinel", "Microsoft Sentinel / Defender XDR", "siem", "KQL", "KQL", "text"),
    ("elastic", "Elastic Security", "siem", "EQL ou ES|QL", "ES|QL", "text"),
    ("qradar", "IBM QRadar", "siem", "AQL (contrôle) + assistant CRE", "AQL", "sql"),
    ("fortisiem", "FortiSIEM", "siem", "Règle FortiSIEM (sous-modèles, export XML)", "Analytics (recherche avancée)", "xml"),
    ("cortex", "Cortex XDR / XSIAM", "xdr", "XQL (corrélation ou BIOC)", "XQL", "text"),
    ("trendvisionone", "Trend Vision One", "xdr", "Modèle de détection personnalisé", "Search app (champ:valeur)", "text"),
    ("ciscoxdr", "Cisco XDR", "xdr", "Règles d'incident et événements de sécurité personnalisés", "Investigation Cisco XDR", "text"),
    ("ciscosna", "Cisco Secure Network Analytics", "ndr", "Événements de sécurité personnalisés", "Recherche de flux", "text"),
    ("googlesecops", "Google SecOps (Chronicle)", "siem", "YARA-L 2.0", "Recherche UDM", "text"),
    ("crowdstrike", "CrowdStrike Falcon Next-Gen SIEM", "siem", "CQL (règle de corrélation)", "CQL", "text"),
    ("sentinelone", "SentinelOne Singularity", "xdr", "Règle STAR (requête Deep Visibility)", "PowerQuery / Deep Visibility", "text"),
    ("sekoia", "Sekoia.io", "siem", "Sigma (règles Sekoia)", "Recherche d'événements Sekoia", "yaml"),
    ("sumologic", "Sumo Logic Cloud SIEM", "siem", "Règles Cloud SIEM", "Requête Sumo Logic", "text"),
    ("rapid7", "Rapid7 InsightIDR", "siem", "Règle de détection personnalisée", "LEQL", "text"),
    ("graylog", "Graylog Security", "siem", "Requête d'alerte (Lucene)", "Lucene", "text"),
    ("exabeam", "Exabeam", "siem", "Règle de corrélation", "Exabeam Search", "text"),
    ("arcsight", "OpenText ArcSight", "siem", "Règle ESM (conditions)", "Recherche ArcSight", "text"),
    ("logpoint", "Logpoint", "siem", "Requête d'alerte Logpoint", "Recherche Logpoint", "text"),
    ("securonix", "Securonix", "siem", "Politique de détection", "Spotter", "text"),
    ("datadog", "Datadog Cloud SIEM", "siem", "Règle de détection (requête de logs)", "Syntaxe de recherche Datadog", "text"),
    ("sigma", "Sigma (format générique)", "generique", "Règle Sigma (YAML)", "Sigma (YAML)", "yaml"),
]

# Colonnes du tableau « Traduire la logique » du Lisez-moi Excel → code de plateforme
_HEADER_KEYS = (("wazuh", "wazuh"), ("splunk", "splunk"), ("sentinel", "sentinel"), ("defender", "sentinel"), ("elastic", "elastic"), ("qradar", "qradar"))


def ensure_siems() -> dict[str, Siem]:
    """Crée les plateformes manquantes (sans toucher à celles que l'utilisateur a modifiées)."""
    out = {}
    for i, (code, nom, categorie, lr, lh, mode) in enumerate(SIEMS):
        siem, _ = Siem.objects.get_or_create(
            code=code,
            defaults={"nom": nom, "categorie": categorie, "langage_regle": lr, "langage_hunting": lh, "mode_editeur": mode, "ordre": i},
        )
        out[code] = siem
    return out


def siem_code_from_header(header: str) -> str | None:
    h = (header or "").lower()
    for key, code in _HEADER_KEYS:
        if key in h:
            return code
    return None
