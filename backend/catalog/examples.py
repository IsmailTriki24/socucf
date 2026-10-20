"""Exemples de règles et de hunting pour DET-001 (plan §Syntaxe par SIEM).

À valider sur un environnement de test : les noms de champs et les identifiants de règles parentes
dépendent de la version et de la normalisation de chaque SIEM.
"""

PARAMS_DET001 = {"seuil": 8, "fenetre": "10m", "fenetre_secondes": 600, "fenetre_minutes": 10, "seuil_hunting": 20}

WAZUH = """<group name="uc_factory,authentication,">
  <!-- DET-001 étape 1 : au moins {{seuil}} échecs du même compte en {{fenetre}} -->
  <rule id="100100" level="8" frequency="{{seuil}}" timeframe="{{fenetre_secondes}}">
    <if_matched_sid>60122</if_matched_sid>
    <same_field>win.eventdata.targetUserName</same_field>
    <description>DET-001 : {{seuil}} échecs d'authentification pour $(win.eventdata.targetUserName) en {{fenetre}}</description>
    <mitre><id>T1110.001</id></mitre>
  </rule>
  <!-- DET-001 étape 2 : succès du même compte après l'étape 1 -->
  <rule id="100101" level="12" timeframe="{{fenetre_secondes}}">
    <if_sid>60106</if_sid>
    <if_matched_sid>100100</if_matched_sid>
    <same_field>win.eventdata.targetUserName</same_field>
    <description>DET-001 : connexion réussie de $(win.eventdata.targetUserName) après une force brute</description>
    <mitre><id>T1110.001</id><id>T1078</id></mitre>
  </rule>
</group>"""

SPLUNK = """index=wineventlog (EventCode=4625 OR EventCode=4624)
| bin _time span={{fenetre}}
| stats count(eval(EventCode=4625)) AS echecs
        max(eval(if(EventCode=4625, _time, null()))) AS dernier_echec
        max(eval(if(EventCode=4624, _time, null()))) AS dernier_succes
        values(src_ip) AS ip_sources
        BY _time, user
| where echecs>={{seuil}} AND dernier_succes>dernier_echec"""

SENTINEL = """let seuil = {{seuil}};
let fenetre = {{fenetre}};
let echecs = SecurityEvent
    | where TimeGenerated > ago(1h)
    | where EventID == 4625
    | summarize NbEchecs = count(), DernierEchec = max(TimeGenerated) by TargetAccount, bin(TimeGenerated, fenetre)
    | where NbEchecs >= seuil;
echecs
| join kind=inner (
    SecurityEvent
    | where TimeGenerated > ago(1h)
    | where EventID == 4624
    | project Succes = TimeGenerated, TargetAccount, IpAddress
  ) on TargetAccount
| where Succes between (DernierEchec .. (DernierEchec + fenetre))
| project TargetAccount, NbEchecs, DernierEchec, Succes, IpAddress"""

ELASTIC = """sequence by user.name with maxspan={{fenetre}}
  [authentication where event.outcome == "failure"] with runs={{seuil}}
  [authentication where event.outcome == "success"]"""

QRADAR = """SELECT username, sourceip, COUNT(*) AS echecs, MAX(starttime) AS dernier_echec
FROM events
WHERE LOGSOURCETYPENAME(devicetype) = 'Microsoft Windows Security Event Log'
  AND "EventID" = '4625'
GROUP BY username, sourceip
HAVING echecs >= {{seuil}}
LAST {{fenetre_minutes}} MINUTES"""

HUNTING_SENTINEL = """SecurityEvent
| where TimeGenerated > ago(7d)
| where EventID in (4624, 4625)
| summarize Echecs = countif(EventID == 4625),
            Succes = countif(EventID == 4624),
            PremierEchec = minif(TimeGenerated, EventID == 4625),
            DernierSucces = maxif(TimeGenerated, EventID == 4624),
            IpSources = make_set(IpAddress, 20)
    by TargetAccount
| where Echecs >= {{seuil_hunting}} and Succes > 0 and DernierSucces > PremierEchec
| order by Echecs desc"""

SYNTAXES_DET001 = {
    "wazuh": (WAZUH, ["win.eventdata.targetUserName"], "Règles locales : corrélation par règle fille. Valider les identifiants de règles parentes (60122, 60106) sur la version Wazuh du client."),
    "splunk": (SPLUNK, ["EventCode", "user", "src_ip"], "Recherche planifiée toutes les 10 min."),
    "sentinel": (SENTINEL, ["SecurityEvent.EventID", "TargetAccount", "IpAddress"], "Règle analytique planifiée (KQL)."),
    "elastic": (ELASTIC, ["event.category", "event.outcome", "user.name"], "Règle EQL de type séquence."),
    "qradar": (QRADAR, ["EventID", "username", "sourceip"], "La corrélation se construit dans l'assistant de règles (CRE). Cette requête AQL sert au contrôle et au hunting ; la propriété « EventID » dépend du DSM installé."),
}


EXCLUSIONS_DET001 = """Comptes de service dont le mot de passe a expiré ou a changé (échecs répétés sans attaque).
Scanners de vulnérabilités et outils de supervision qui s'authentifient en boucle.
Postes de test et environnements de recette identifiés dans une liste de référence."""
RECOMMANDATION_DET001 = """Verrouiller le compte après N échecs et imposer le MFA sur les accès exposés.
Sur alerte : vérifier l'IP source (interne, VPN, externe), contacter l'utilisateur, forcer un changement de mot de passe si le succès suit les échecs.
Régler le seuil après deux semaines d'observation."""
IMPACT_DET001 = "Un succès après une série d'échecs indique probablement un compte compromis : accès initial, puis élévation de privilèges et déplacement latéral. Gravité haute si le compte est privilégié."
