"""Exclusions, recommandation et impact : identité et annuaire, postes Windows, Linux (DET-002 à DET-028).

Textes de départ à adapter à chaque client : les listes entre guillemets (comptes de service, hôtes d'administration…)
doivent être remplacées par les valeurs réelles du client dans ses listes de référence.
"""

CONSEILS_A = {
    "DET-002": {
        "exclusions": "Passerelles NAT, proxys et sorties Internet partagées par de nombreux utilisateurs (beaucoup de comptes depuis une même IP).\nScanners d'authentification et outils de test d'intrusion planifiés.\nApplications qui testent des identifiants en boucle après un changement de mot de passe de masse.",
        "recommandation": "Bloquer ou limiter l'IP source au pare-feu ou au proxy d'authentification.\nVérifier les comptes qui ont réussi : forcer le changement de mot de passe, révoquer les sessions et jetons, imposer le MFA.\nActiver le verrouillage intelligent (smart lockout) et interdire les mots de passe courants.",
        "impact": "Un seul mot de passe faible suffit à ouvrir un compte sans déclencher le verrouillage. Le compte obtenu sert d'accès initial : messagerie, VPN, puis élévation de privilèges et déplacement latéral.",
    },
    "DET-003": {
        "exclusions": "Changement de mot de passe de masse ou expiration planifiée (rentrée, fin de trimestre).\nApplication ou service mobile qui rejoue un ancien mot de passe sur de nombreux comptes.\nPostes de test et comptes de formation.",
        "recommandation": "Retrouver l'IP ou le poste source des échecs (événements 4625 / 4771) et le bloquer.\nDistinguer attaque de type spraying et déni de service sur les comptes ; débloquer les comptes de service critiques en priorité.\nVérifier que la politique de verrouillage ne permet pas à un attaquant de bloquer toute l'entreprise.",
        "impact": "Blocage des utilisateurs et des services (déni de service sur les comptes), souvent signe d'un spraying en cours ou d'une application mal configurée. Peut masquer une attaque réelle dans le bruit.",
    },
    "DET-004": {
        "exclusions": "IP des VPN, proxys et passerelles de sécurité de l'entreprise (elles faussent la géolocalisation).\nVoyageurs déclarés : liste de déplacements validée par les RH ou la sécurité.\nComptes de service et applications cloud qui s'authentifient depuis des datacenters.",
        "recommandation": "Contacter l'utilisateur pour confirmer ses deux connexions.\nSi non confirmé : révoquer les sessions et jetons, réinitialiser le mot de passe, vérifier les règles de boîte et les méthodes MFA ajoutées.\nAppliquer une politique d'accès conditionnel par pays et par niveau de risque.",
        "impact": "Compte probablement utilisé par une tierce personne : accès aux données, à la messagerie et aux applications avec les droits de l'utilisateur, sans alerte visible pour lui.",
    },
    "DET-005": {
        "exclusions": "Processus officiel d'arrivée d'un administrateur (ticket validé, automatisation de provisionnement).\nComptes d'administration créés par l'outil de gestion des identités ou le pipeline d'automatisation.\nCréations lors d'une migration ou d'un déploiement planifié.",
        "recommandation": "Contacter l'acteur et vérifier le ticket de changement.\nSans justification : désactiver le compte créé, retirer le groupe privilégié, changer les secrets de l'acteur et auditer ses autres actions des dernières 24 h.\nLimiter par principe qui peut créer des comptes et gérer les groupes privilégiés.",
        "impact": "Création d'une porte dérobée avec droits d'administrateur : persistance durable et contrôle complet de l'annuaire ou du cloud, difficile à retirer si elle n'est pas détectée.",
    },
    "DET-006": {
        "exclusions": "Administrateurs habilités listés dans la liste de référence, pendant les fenêtres de changement.\nOutils de gestion des accès privilégiés (PAM) qui ajoutent et retirent des membres de façon temporaire.\nProcessus automatisé d'élévation à la demande (just-in-time).",
        "recommandation": "Comparer avec le ticket de changement.\nSans justification : retirer le membre ajouté, identifier la session de l'acteur et vérifier son compte.\nTenir à jour la liste des groupes privilégiés et celle des administrateurs habilités.",
        "impact": "Un compte reçoit des droits étendus hors contrôle : il peut lire ou modifier l'ensemble du domaine, créer des persistances et désactiver la sécurité.",
    },
    "DET-007": {
        "exclusions": "Comptes de service applicatifs légitimes qui demandent beaucoup de tickets (SQL, supervision), identifiés dans une liste.\nOutils d'audit Active Directory et scanners de sécurité autorisés.\nComptes machine (se terminant par $) et krbtgt.",
        "recommandation": "Identifier le compte demandeur et les comptes de service ciblés (SPN).\nChanger immédiatement les mots de passe des comptes ciblés : longs (25 caractères ou plus) ou comptes de service gérés (gMSA).\nDésactiver RC4 quand c'est possible et activer la pré-authentification Kerberos sur tous les comptes.",
        "impact": "L'attaquant récupère des tickets qu'il casse hors ligne, sans bruit : il obtient le mot de passe d'un compte de service, souvent très privilégié, sans jamais échouer à se connecter.",
    },
    "DET-008": {
        "exclusions": "Contrôleurs de domaine (réplication normale).\nComptes de synchronisation d'annuaire connus (Entra ID Connect, outils de migration, de sauvegarde ou de supervision d'annuaire).\nSouvent aucune autre exclusion : toute autre source est suspecte.",
        "recommandation": "Traiter comme un incident majeur : isoler la machine source et identifier le compte.\nChanger deux fois le mot de passe du compte krbtgt et réinitialiser les comptes d'administration exposés.\nRetirer les droits de réplication non justifiés sur l'objet domaine.",
        "impact": "L'attaquant copie tous les secrets du domaine (empreintes de mots de passe de tous les comptes, dont krbtgt) : il peut usurper n'importe quel compte et garder l'accès après un changement de mot de passe.",
    },
    "DET-009": {
        "exclusions": "Comptes de supervision, d'inventaire, de sauvegarde et de déploiement qui se connectent à de nombreuses machines (liste de référence).\nServeurs d'administration et de rebond.\nScanners de vulnérabilités authentifiés.",
        "recommandation": "Identifier la machine source et le compte, puis vérifier les connexions réussies vers les cibles.\nIsoler la source si elle est compromise ; réinitialiser le compte et les secrets mis en cache.\nRestreindre NTLM, déployer un modèle d'administration par niveaux (tiering) et un mot de passe administrateur local unique par machine (LAPS).",
        "impact": "L'attaquant réutilise une empreinte de mot de passe volée pour se déplacer de machine en machine sans connaître le mot de passe, jusqu'aux serveurs et contrôleurs de domaine.",
    },
    "DET-010": {
        "exclusions": "Équipe d'administration de l'annuaire, pendant les changements approuvés.\nOutils de gestion des stratégies de groupe (GPO) et de déploiement autorisés.\nCréation d'approbations lors de migrations ou de fusions planifiées.",
        "recommandation": "Comparer avec le ticket de changement et identifier le compte.\nSans justification : annuler la modification (restaurer la GPO ou l'objet), puis auditer les autres actions du compte.\nActiver l'audit des modifications d'annuaire et limiter les droits d'écriture sur la racine du domaine et les contrôleurs.",
        "impact": "Une GPO piégée déploie un logiciel malveillant ou désactive la sécurité sur tout le parc. Modifier AdminSDHolder ou une approbation donne un accès privilégié durable ou ouvre l'accès à d'autres domaines.",
    },
    "DET-011": {
        "exclusions": "Maintenance planifiée documentée (réinstallation, rotation volontaire des journaux).\nProcessus de re-déploiement de postes ou de serveurs de test.\nOutils d'archivage qui vident volontairement le journal après export.",
        "recommandation": "Relever le compte et la machine ; isoler le poste si l'effacement n'est pas justifié.\nRetrouver les événements dans le SIEM : ce qui a été effacé a déjà été collecté si la collecte est en continu.\nRechercher ce que l'attaquant voulait cacher dans les minutes précédentes (exécutions, connexions).",
        "impact": "Un attaquant efface ses traces : l'enquête devient plus difficile et d'autres actions malveillantes ont probablement eu lieu juste avant. Souvent observé en fin d'intrusion ou avant un rançongiciel.",
    },
    "DET-012": {
        "exclusions": "Changements faits par GPO, Intune ou l'outil de gestion officiel de la sécurité.\nExclusions antivirus validées pour des applications métier connues (bases de données, outils de développement).\nMises à jour de l'antivirus qui redémarrent brièvement le service.",
        "recommandation": "Rétablir immédiatement la protection et supprimer l'exclusion non validée.\nIdentifier le compte et le processus à l'origine du changement.\nProtéger l'antivirus contre la falsification (tamper protection) et gérer les exclusions uniquement par stratégie centrale.",
        "impact": "Le poste n'est plus protégé : un malware ou un outil d'attaque peut s'exécuter sans être bloqué. Désactiver l'antivirus précède très souvent un rançongiciel.",
    },
    "DET-013": {
        "exclusions": "Installation de logiciels légitimes qui coupent l'antivirus quelques minutes (certains outils de développement ou installateurs).\nPostes de test et laboratoires.\nScripts d'administration PowerShell encodés d'outils de gestion connus.",
        "recommandation": "Isoler le poste immédiatement et collecter les artefacts (processus, fichiers, connexions).\nRétablir la protection et lancer une analyse complète ; chercher d'autres postes avec le même motif.\nRéinitialiser les comptes connectés sur le poste.",
        "impact": "Séquence typique d'une intrusion active : la défense est coupée puis un programme malveillant s'exécute. Risque élevé de propagation et de chiffrement dans l'heure.",
    },
    "DET-014": {
        "exclusions": "Installeurs, outils de déploiement logiciel et de supervision connus (SCCM, Intune, agents de sauvegarde).\nTâches de maintenance éditeur depuis des dossiers ProgramData standards.\nServices installés par un administrateur identifié, avec ticket.",
        "recommandation": "Examiner le binaire ou le script lancé (hash, signature, emplacement) et le compte qui l'a créé.\nSupprimer le service ou la tâche, puis isoler le poste si le binaire est inconnu.\nChercher la même persistance sur les autres postes.",
        "impact": "Persistance : le malware reprend la main à chaque redémarrage, ou exécution à distance d'un programme avec des droits système.",
    },
    "DET-015": {
        "exclusions": "Serveurs d'administration, de déploiement logiciel et de sauvegarde connus.\nOutils de gestion à distance utilisant les partages administratifs.\nFenêtres de déploiement planifiées.",
        "recommandation": "Isoler la machine cible et celle d'origine ; identifier le compte utilisé.\nExaminer le service créé (binaire, chemin) et le supprimer.\nRestreindre l'accès aux partages administratifs et à la création de services à distance, et segmenter le réseau.",
        "impact": "Exécution de code à distance avec droits élevés, technique classique de propagation dans le réseau, notamment pour déployer un rançongiciel sur de nombreuses machines.",
    },
    "DET-016": {
        "exclusions": "Scripts d'administration et de déploiement signés ou connus qui utilisent des commandes encodées.\nOutils de supervision et d'inventaire (agents) qui téléchargent des modules.\nModules PowerShell d'éditeurs installés légitimement (téléchargement de mises à jour).",
        "recommandation": "Décoder la commande et lire son contenu, identifier le processus parent et l'utilisateur.\nSi malveillant : isoler le poste, chercher les connexions sortantes et fichiers déposés.\nActiver la journalisation des blocs de script PowerShell et le mode de langage contraint.",
        "impact": "PowerShell obfusqué ou téléchargeant du code sert à lancer un malware sans fichier, à voler des identifiants ou à installer un accès distant, en contournant bien des protections.",
    },
    "DET-017": {
        "exclusions": "Macros métier signées et approuvées (finance, comptabilité) qui lancent un script.\nSuites bureautiques utilisant des modules complémentaires connus.\nOutils de conversion de documents légitimes.",
        "recommandation": "Récupérer le document et l'e-mail d'origine ; isoler le poste.\nExaminer la commande lancée et les téléchargements qui suivent.\nBloquer les macros issues d'Internet et appliquer les règles de réduction de la surface d'attaque (ASR).",
        "impact": "Premier signe d'un phishing réussi : un document piégé exécute du code sur le poste de l'utilisateur, souvent le début d'un accès distant ou d'un rançongiciel.",
    },
    "DET-018": {
        "exclusions": "Scripts d'administration et outils de déploiement qui utilisent certutil, bitsadmin ou msiexec avec une URL interne.\nMises à jour logicielles qui passent par BITS.\nInstallations déclenchées depuis un serveur de distribution connu.",
        "recommandation": "Examiner l'URL ou le fichier téléchargé et le processus parent ; isoler le poste si la destination est externe et inconnue.\nBloquer l'accès des postes aux binaires inutiles quand c'est possible (AppLocker, WDAC).\nAjouter des règles de blocage réseau pour la destination.",
        "impact": "L'attaquant utilise des outils système de confiance pour télécharger et lancer du code sans fichier évident, contournant l'antivirus et les listes de blocage.",
    },
    "DET-019": {
        "exclusions": "Composants système et EDR habituels (liste précise par éditeur et version).\nOutils de sauvegarde, de supervision et d'audit de sécurité autorisés.\nProcessus de collecte de diagnostics demandés par un éditeur (avec ticket).",
        "recommandation": "Isoler le poste immédiatement et préserver la mémoire si possible.\nConsidérer tous les comptes connectés sur la machine comme compromis : réinitialiser leurs mots de passe, en priorité les comptes privilégiés.\nActiver la protection de LSASS (RunAsPPL, Credential Guard) et supprimer les droits d'administrateur local inutiles.",
        "impact": "Vol de mots de passe et de tickets en mémoire : l'attaquant peut usurper les comptes connectés, dont des administrateurs de domaine, et prendre le contrôle du réseau.",
    },
    "DET-020": {
        "exclusions": "Hôtes d'administration et de supervision listés (SCCM, outils de gestion de parc, monitoring).\nScripts d'automatisation planifiés connus.\nOutils de déploiement logiciel à distance.",
        "recommandation": "Identifier l'hôte et le compte à l'origine, puis la commande lancée.\nIsoler l'hôte source si hors liste d'administration ; réinitialiser le compte utilisé.\nRestreindre WMI et WinRM aux postes d'administration (pare-feu hôte) et journaliser leur usage.",
        "impact": "Exécution de commandes à distance : l'attaquant se déplace d'une machine à l'autre en discrétion, souvent avec des droits administrateur.",
    },
    "DET-021": {
        "exclusions": "Serveurs de rebond, bastions et postes d'administration légitimes.\nAdministrateurs d'infrastructure qui interviennent sur plusieurs serveurs (avec ticket).\nOutils de supervision et d'inventaire qui testent le RDP.",
        "recommandation": "Identifier le compte ou l'IP source et la liste des machines atteintes ; vérifier les sessions ouvertes.\nIsoler la source, réinitialiser le compte, fermer les sessions.\nLimiter le RDP aux bastions, imposer le MFA et l'authentification au niveau réseau (NLA).",
        "impact": "Un attaquant avec un accès valide prospecte le réseau pour trouver des serveurs intéressants : étape de déplacement latéral précédant l'exfiltration ou le chiffrement.",
    },
    "DET-022": {
        "exclusions": "Administrateurs habilités listés (liste de référence), comptes de maintenance connus.\nOutils de gestion de configuration qui passent par root (Ansible, Puppet).\nDépannage planifié avec ticket.",
        "recommandation": "Désactiver la connexion root directe en SSH (PermitRootLogin no) et imposer sudo avec des comptes nominatifs.\nVérifier l'utilisateur à l'origine et la source de la connexion.\nSi non justifié, couper la session et renouveler les clés et mots de passe.",
        "impact": "Un accès root donne le contrôle total de la machine : lecture de tous les secrets, installation de persistances, effacement des traces.",
    },
    "DET-023": {
        "exclusions": "Administrateurs qui se trompent de mot de passe puis réussissent (ajustez le seuil).\nScripts d'automatisation avec un mot de passe sudo périmé.\nComptes de test.",
        "recommandation": "Contacter l'utilisateur ; vérifier la commande exécutée (shell root, su).\nSi suspect : verrouiller le compte, auditer l'historique et les modifications faites en root.\nLimiter les commandes sudo autorisées par compte (principe du moindre privilège) et imposer le MFA pour sudo.",
        "impact": "Élévation de privilèges réussie : un compte standard obtient les droits root par force brute ou par vol d'un mot de passe, ouvrant la voie à la persistance et au vol de données.",
    },
    "DET-024": {
        "exclusions": "Processus officiel d'arrivée d'un administrateur (ticket, outil de gestion de configuration).\nProvisionnement automatisé de serveurs.\nCréations de comptes de service lors d'un déploiement planifié.",
        "recommandation": "Vérifier le ticket et l'acteur ; désactiver le compte et retirer les droits sudo sans justification.\nContrôler /etc/sudoers et /etc/sudoers.d, ainsi que les clés SSH ajoutées.\nCentraliser la création de comptes via l'outil de gestion de configuration.",
        "impact": "Porte dérobée avec droits root : contrôle durable de la machine, difficile à détecter après coup.",
    },
    "DET-025": {
        "exclusions": "Outil de gestion de configuration (Ansible, Puppet, Chef) et fenêtres de maintenance.\nMises à jour de paquets qui modifient ces fichiers.\nProvisionnement d'un nouvel utilisateur par la procédure officielle.",
        "recommandation": "Comparer le fichier à sa version de référence, identifier le processus et le compte à l'origine.\nSi malveillant : restaurer le fichier, isoler la machine et chercher d'autres modifications.\nSurveiller en continu avec le FIM et protéger ces fichiers (droits, attributs immuables).",
        "impact": "Modifier les fichiers d'authentification ou ld.so.preload donne un accès persistant, permet de voler des mots de passe ou d'injecter du code dans tous les programmes lancés.",
    },
    "DET-026": {
        "exclusions": "Outil de gestion de configuration et paquets installés par l'équipe d'exploitation.\nTâches planifiées de sauvegarde et de supervision connues.\nServices créés lors d'un déploiement applicatif planifié.",
        "recommandation": "Examiner le script ou le binaire lancé (emplacement, contenu, propriétaire).\nSupprimer la tâche ou le service et rechercher son origine (connexion, compte).\nInterdire l'exécution depuis /tmp et /dev/shm (montage noexec).",
        "impact": "Persistance : le code de l'attaquant redémarre avec la machine ou à intervalle régulier, même après nettoyage partiel.",
    },
    "DET-027": {
        "exclusions": "Outils de supervision et de test réseau utilisés par l'exploitation.\nBinaires de développement exécutés depuis /tmp lors de compilations ou de tests.\nScripts d'installation de paquets qui s'exécutent depuis un dossier temporaire.",
        "recommandation": "Isoler le serveur immédiatement ; relever la destination de la connexion et le processus.\nCollecter les artefacts (processus, binaires, fichiers récents) avant tout redémarrage.\nBloquer la destination au pare-feu et chercher la même activité ailleurs.",
        "impact": "L'attaquant a déjà du code qui s'exécute sur le serveur et dispose d'un accès interactif à distance : vol de données, déplacement vers d'autres systèmes.",
    },
    "DET-028": {
        "exclusions": "Rotation de journaux (logrotate) et nettoyages planifiés.\nMaintenance du service d'audit ou de syslog documentée.\nProcessus de réinstallation ou de clonage de machines de test.",
        "recommandation": "Identifier le compte et la session ; rechercher les actions qui précèdent l'effacement.\nVérifier que les logs sont envoyés en temps réel vers le SIEM (une copie distante survit à l'effacement).\nProtéger les journaux (append-only, envoi distant) et alerter à l'arrêt de l'audit.",
        "impact": "Un attaquant cherche à masquer son passage : l'enquête perd des preuves et une intrusion active est probable.",
    },
}
