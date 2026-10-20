"""Exclusions, recommandation et impact : bases de données et données, conteneurs, rançongiciel, santé du SOC (DET-062 à DET-082)."""

CONSEILS_C = {
    "DET-062": {
        "exclusions": "Applications dont le mot de passe de base de données a expiré ou changé (échecs répétés puis succès après correction).\nOutils de supervision et de sauvegarde mal configurés.\nDéveloppeurs et administrateurs de base qui se trompent de mot de passe.",
        "recommandation": "Vérifier la source des échecs (hôte, compte) et le compte qui a réussi ; changer son mot de passe si suspect.\nRestreindre l'accès à la base aux serveurs applicatifs et aux postes d'administration.\nActiver le verrouillage de compte et surveiller les comptes applicatifs utilisés depuis un autre hôte.",
        "impact": "Accès direct à la base de données avec un compte valide : lecture, modification ou export de données sensibles sans passer par l'application.",
    },
    "DET-063": {
        "exclusions": "Postes d'administration de bases et de développement listés (liste de référence), avec comptes nominatifs.\nOutils de reporting, d'intégration et de sauvegarde connus.\nAccès temporaires de dépannage avec ticket et date de fin.",
        "recommandation": "Identifier l'hôte et le compte ; couper la session et vérifier les requêtes exécutées.\nFermer l'accès direct de ce poste au port de la base (pare-feu, groupe de sécurité).\nSéparer les comptes applicatifs des comptes humains et interdire leur usage interactif.",
        "impact": "Contournement de l'application : un compte applicatif volé ou un poste compromis lit ou modifie les données directement, souvent avec de larges droits.",
    },
    "DET-064": {
        "exclusions": "Sauvegardes, exports et extractions planifiés (ETL, entrepôt de données, reporting mensuel).\nMigrations et copies de données approuvées.\nTraitements analytiques ou de test de charge.",
        "recommandation": "Identifier le compte, l'hôte et la requête ; interrompre la session si elle n'est pas planifiée.\nÉvaluer les données lues (personnelles, financières) pour déclencher la procédure de fuite si besoin.\nLimiter les droits de lecture massive et exiger une approbation pour les exports.",
        "impact": "Exfiltration de données sensibles : fuite de dossiers clients ou de données personnelles, avec un risque réglementaire (notification) et d'extorsion.",
    },
    "DET-065": {
        "exclusions": "Maintenance planifiée et opérations de l'équipe DBA avec ticket.\nDéploiements applicatifs et migrations de schéma exécutés par l'outil prévu.\nCréation de comptes lors d'un provisionnement approuvé.",
        "recommandation": "Vérifier le ticket et l'acteur ; retirer les droits ou désactiver xp_cmdshell si non justifié.\nContrôler ce qui a été exécuté ensuite (commandes système, tables supprimées) et restaurer si besoin.\nLimiter les comptes d'administration de la base et activer l'audit de toutes leurs actions.",
        "impact": "Un compte obtient un contrôle total de la base ou exécute des commandes sur le serveur : vol, destruction de données (DROP, TRUNCATE) ou pivot vers le système d'exploitation.",
    },
    "DET-066": {
        "exclusions": "Sauvegardes et archivages vers des destinations autorisées (cloud d'entreprise, FTP partenaire connu).\nTransferts approuvés de gros volumes à un client ou prestataire.\nOutils de transfert de fichiers managés (MFT).",
        "recommandation": "Identifier l'hôte, l'utilisateur et la destination ; isoler l'hôte et bloquer la destination.\nÉvaluer le contenu de l'archive pour mesurer la fuite.\nBloquer les services de stockage personnels et limiter les volumes sortants.",
        "impact": "Étape classique d'exfiltration : les données sont regroupées puis envoyées à l'extérieur, souvent avant un chiffrement ou une extorsion.",
    },
    "DET-067": {
        "exclusions": "Sauvegardes, antivirus, indexation et outils de migration (comptes de service).\nUtilisateurs dont le métier est de manipuler beaucoup de fichiers (archivage, juridique).\nCopies planifiées pour un projet identifié.",
        "recommandation": "Contacter l'utilisateur ; sinon suspendre son accès et vérifier les fichiers touchés.\nCroiser avec les accès hors horaires, les clés USB et les envois externes.\nClasser les dossiers sensibles et limiter les droits au strict nécessaire.",
        "impact": "Collecte de documents par un salarié malveillant ou un compte compromis, en préparation d'une fuite de données.",
    },
    "DET-068": {
        "exclusions": "Sauvegardes locales approuvées sur support amovible (avec procédure).\nServices cloud d'entreprise autorisés (OneDrive, SharePoint, Drive d'entreprise).\nTransferts de gros fichiers autorisés (médias, CAO) par des équipes identifiées.",
        "recommandation": "Contacter l'utilisateur et vérifier la nature des fichiers copiés.\nBloquer le stockage personnel et les périphériques amovibles non autorisés (contrôle des périphériques, proxy).\nSensibiliser sur les règles d'usage des données.",
        "impact": "Fuite de données par un salarié ou un poste compromis, volontaire ou non, vers un support ou un service hors du contrôle de l'entreprise.",
    },
    "DET-069": {
        "exclusions": "Composants système et d'infrastructure (CNI, agents de supervision, stockage) qui nécessitent ces droits (liste précise).\nOutils de sécurité déployés en privileged (EDR conteneur).\nEnvironnements de développement isolés.",
        "recommandation": "Examiner l'image, l'auteur et la raison ; arrêter le conteneur s'il n'est pas justifié.\nAppliquer des politiques d'admission (Pod Security Standards, Kyverno, OPA Gatekeeper) qui interdisent ces options.\nVérifier ce qui a été accédé sur le nœud.",
        "impact": "Un conteneur privilégié ou avec montage sensible permet de s'échapper vers le nœud hôte et de prendre le contrôle du cluster entier.",
    },
    "DET-070": {
        "exclusions": "Équipe d'exploitation et de support de niveau 3 pendant un incident ou un dépannage (ticket).\nOutils de débogage approuvés.\nComptes de service de CI/CD qui exécutent des commandes de test.",
        "recommandation": "Vérifier l'acteur, le ticket et les commandes lancées si l'audit de commandes est actif.\nRestreindre pods/exec aux administrateurs via RBAC et exiger une approbation en production.\nInterdire les shells dans les images de production (images minimales).",
        "impact": "Un accès interactif à un conteneur de production permet de voler des secrets montés, de modifier l'application ou de pivoter dans le cluster.",
    },
    "DET-071": {
        "exclusions": "Installation et opérations d'administration du cluster par l'équipe plateforme (avec ticket).\nComposants du cluster qui exigent des droits étendus (opérateurs, outils de déploiement continu).\nCréation d'un environnement de test.",
        "recommandation": "Vérifier le ticket ; supprimer la liaison ou le rôle si non justifié.\nAuditer les actions du compte bénéficiaire.\nAppliquer le moindre privilège (rôles limités à un namespace) et réviser régulièrement les ClusterRoleBindings.",
        "impact": "Un compte obtient le contrôle total du cluster : accès à tous les secrets, déploiement de conteneurs malveillants et désactivation de la sécurité.",
    },
    "DET-072": {
        "exclusions": "Maintenance planifiée des hôtes (activation temporaire du shell pour dépannage, avec ticket).\nMise en maintenance ou arrêt programmé de machines virtuelles (migration, mise à jour).\nAdministrateurs depuis des postes d'administration connus.",
        "recommandation": "Isoler le réseau de gestion de l'hyperviseur si l'activité n'est pas planifiée ; identifier le compte.\nVérifier l'état des sauvegardes et les machines arrêtées ; rallumer si possible.\nDésactiver le shell et le SSH par défaut, limiter l'accès à un réseau de gestion dédié et imposer le MFA.",
        "impact": "Attaque directe sur la virtualisation (typique des rançongiciels ciblant ESXi) : un seul accès permet d'arrêter ou de chiffrer des dizaines de serveurs d'un coup.",
    },
    "DET-073": {
        "exclusions": "Procédures de maintenance et de réinitialisation documentées (rare sur des postes standards).\nOutils de sauvegarde qui gèrent eux-mêmes leurs clichés (VSS) selon leur configuration.\nServeurs de test.",
        "recommandation": "Isoler immédiatement la machine ; c'est un précurseur de chiffrement.\nIdentifier le processus et le compte à l'origine ; vérifier l'état des sauvegardes hors ligne.\nChercher le même comportement sur d'autres machines et préparer la réponse à un rançongiciel.",
        "impact": "L'attaquant détruit les points de restauration locaux avant de chiffrer : la récupération des données sans sauvegarde externe devient très difficile. Très forte probabilité de rançongiciel imminent.",
    },
    "DET-074": {
        "exclusions": "Outils de sauvegarde, de compression, de chiffrement légitime (disque, dossier) et de migration qui modifient beaucoup de fichiers.\nAntivirus pendant une analyse ou une mise en quarantaine.\nMises à jour majeures d'applications.",
        "recommandation": "Isoler l'hôte du réseau immédiatement (EDR, port, câble) et couper les partages montés.\nIdentifier le processus et le compte ; préserver la mémoire si possible.\nActiver le plan de réponse rançongiciel : vérifier les sauvegardes hors ligne, chercher les autres hôtes touchés.",
        "impact": "Chiffrement des données de l'entreprise : arrêt d'activité, pertes de données, demande de rançon et risque de publication des données volées.",
    },
    "DET-075": {
        "exclusions": "Quasi aucune : cette chaîne est très spécifique.\nProcédures de réinitialisation de postes avec ticket, à documenter au cas par cas.",
        "recommandation": "Considérer comme un rançongiciel en cours : isoler l'hôte et les partages immédiatement.\nGarder les sauvegardes hors ligne à l'abri ; lister les hôtes avec la même chaîne.\nAlerter la cellule de crise et suivre la procédure de réponse (communication, juridique, assurance).",
        "impact": "Attaque de rançongiciel en phase finale : suppression des restaurations puis chiffrement, avec une perte de données massive et un arrêt d'activité probables.",
    },
    "DET-076": {
        "exclusions": "Maintenance planifiée de la solution de sauvegarde (ticket).\nChangements de politique de rétention approuvés.\nRetrait de jobs obsolètes lors d'une migration.",
        "recommandation": "Vérifier le ticket ; recréer ou réactiver les jobs et tester une restauration.\nIdentifier le compte et protéger l'accès à la console de sauvegarde (MFA, compte dédié).\nMaintenir au moins une copie hors ligne ou immuable.",
        "impact": "Sans sauvegardes, un rançongiciel devient impossible à récupérer : l'attaquant les supprime avant de chiffrer pour forcer le paiement.",
    },
    "DET-077": {
        "exclusions": "Connexions sortantes de mises à jour et de services cloud légitimes (listes d'IP ou de domaines).\nDétections de faux positifs de l'antivirus sur des outils internes.\nPostes de test et de recherche en sécurité.",
        "recommandation": "Isoler l'hôte ; vérifier le fichier détecté et la destination de la connexion.\nBloquer la destination et lancer une analyse complète du poste.\nChercher d'autres hôtes qui contactent la même destination.",
        "impact": "Un malware est resté actif malgré la détection et parle à son serveur de contrôle : vol de données, installation d'autres outils d'attaque.",
    },
    "DET-078": {
        "exclusions": "Installeurs et mises à jour légitimes lancés depuis Téléchargements ou un dossier temporaire.\nOutils de déploiement logiciel et de supervision.\nPostes de développement qui compilent et exécutent des binaires locaux.",
        "recommandation": "Examiner le processus (signature, hash, parent) et la persistance créée ; isoler le poste si inconnu.\nSupprimer la persistance et le binaire, puis chercher d'autres postes avec la même chaîne.\nRestreindre l'exécution depuis les dossiers utilisateur (AppLocker, WDAC).",
        "impact": "Un code inconnu s'installe durablement sur le poste : l'attaquant garde l'accès à chaque redémarrage et peut préparer la suite (vol d'identifiants, propagation).",
    },
    "DET-079": {
        "exclusions": "Maintenance planifiée d'une source (redémarrage, mise à jour, coupure réseau).\nSources volontairement peu bavardes (équipements de test, serveurs éteints le week-end).\nHoraires d'activité propres à certains sites ou ateliers.",
        "recommandation": "Vérifier l'état du serveur ou de l'équipement et du collecteur ; relancer l'agent ou le service.\nIdentifier la période sans log et rejouer la recherche d'activités suspectes sur celle-ci.\nDéfinir pour chaque source critique un délai de silence adapté et un propriétaire.",
        "impact": "Un angle mort : pendant que la source est silencieuse, aucune détection ne peut se déclencher. Peut aussi être provoqué par un attaquant qui coupe l'envoi de logs.",
    },
    "DET-080": {
        "exclusions": "Redémarrages et mises à jour planifiés (patch tuesday, maintenance).\nMachines éteintes volontairement (postes de test, serveurs de secours).\nRéinstallations de l'agent lors d'une migration.",
        "recommandation": "Redémarrer l'agent et vérifier la reconnexion ; identifier qui a arrêté le service si l'arrêt est manuel.\nRechercher d'éventuelles activités suspectes sur le serveur pendant la coupure.\nActiver la protection de l'agent contre la désinstallation et alerter sur tout arrêt manuel.",
        "impact": "Sans agent, le serveur critique n'est plus surveillé : l'attaquant le désactive souvent avant d'agir pour ne pas être vu.",
    },
    "DET-081": {
        "exclusions": "Variations saisonnières et événements prévisibles (clôture mensuelle, fermeture d'un site, campagne de migration).\nSources récemment ajoutées ou dont la verbosité a été modifiée volontairement.\nPériodes de congés et de week-ends (utiliser une ligne de base par heure et jour de la semaine).",
        "recommandation": "Comparer avec les changements récents (configuration, mise à jour) ; vérifier l'état du collecteur.\nChute : chercher la cause de la perte de collecte ; pic : chercher un excès de verbosité ou une attaque (déni de service, balayage).\nAjuster les seuils par source après quelques semaines d'observation.",
        "impact": "Une chute signale une perte de visibilité, un pic une saturation du SIEM (coûts, retards) ou une attaque en cours : dans les deux cas, la détection est dégradée.",
    },
    "DET-082": {
        "exclusions": "Changements approuvés par le processus de gestion des changements du SOC (ticket).\nRéglages de bruit documentés (ajout d'exclusions validées par un second analyste).\nCréation de comptes lors de l'arrivée de nouveaux analystes.",
        "recommandation": "Comparer la modification avec le ticket ; la rétablir si elle n'est pas validée.\nIdentifier le compte et auditer ses autres actions dans le SIEM.\nGérer les règles comme du code (versionnage, revue par un tiers) et limiter les droits d'administration du SIEM.",
        "impact": "Un attaquant ou un initié affaiblit la détection : règle désactivée, exclusion ajoutée ou rétention réduite, ce qui lui permet d'agir sans alerte.",
    },
}
