"""Exclusions, recommandation et impact : web et applications, réseau, messagerie et SaaS, cloud (DET-029 à DET-061)."""

CONSEILS_B = {
    "DET-029": {
        "exclusions": "Scanners de vulnérabilités et tests d'intrusion autorisés (IP et User-Agent à lister).\nRobots d'indexation légitimes et outils de supervision de disponibilité.\nApplications qui génèrent beaucoup de 404 (liens cassés après une refonte).",
        "recommandation": "Bloquer l'IP au WAF si elle persiste ; ne pas investiguer chaque scan isolé.\nSurveiller si la même IP enchaîne ensuite avec une exploitation (voir DET-031).\nMaintenir le WAF et les correctifs à jour : c'est ce qui compte face au bruit de fond d'Internet.",
        "impact": "Faible en soi : l'attaquant cartographie le site et cherche une faille. À surveiller seulement comme préambule d'une exploitation.",
    },
    "DET-030": {
        "exclusions": "Tests de sécurité planifiés et scanners autorisés.\nContenu légitime qui ressemble à une injection (éditeur de code, forum technique, outils de documentation).\nRequêtes bloquées par le WAF (réponse 403) : à garder en information.",
        "recommandation": "Regarder la réponse du serveur : un 200 ou 500 signifie que la requête a atteint l'application.\nVérifier les journaux applicatifs et de base de données pour la même période.\nCorriger la vulnérabilité (requêtes paramétrées, validation des entrées) et durcir les règles du WAF.",
        "impact": "Injection SQL, exécution de code ou lecture de fichiers : accès aux données de l'application, voire contrôle du serveur. Critique si la faille (par exemple Log4Shell) est exploitée avec succès.",
    },
    "DET-031": {
        "exclusions": "Scanners de vulnérabilités ou tests d'intrusion planifiés (IP à lister).\nOutils de supervision applicative qui testent des motifs d'attaque.\nRequêtes bloquées par le WAF sans réponse 200 ou 500.",
        "recommandation": "Traiter comme une attaque active : bloquer l'IP, isoler ou protéger l'application visée.\nVérifier la requête réussie et les fichiers ou processus créés ensuite sur le serveur.\nAppliquer le correctif de la faille ciblée et chercher les mêmes requêtes sur les autres serveurs.",
        "impact": "Un attaquant a cartographié le site puis exploité une faille avec succès : compromission probable du serveur web et accès aux données et au réseau interne.",
    },
    "DET-032": {
        "exclusions": "Déploiements applicatifs planifiés et pipelines de livraison (CI/CD).\nMises à jour de CMS, de plugins et de thèmes par l'équipe web.\nUploads légitimes de fichiers par des comptes autorisés dans un dossier prévu à cet effet.",
        "recommandation": "Isoler le serveur ; récupérer et analyser le fichier (hash, contenu), puis le supprimer.\nIdentifier la faille d'entrée (upload, injection, compte volé) et la corriger.\nChanger les secrets présents sur le serveur (bases, clés) et chercher d'autres webshells.",
        "impact": "Une webshell donne à l'attaquant une commande à distance sur le serveur : vol de données, pivot vers le réseau interne, déploiement de rançongiciel.",
    },
    "DET-033": {
        "exclusions": "Applications qui lancent volontairement des commandes (outils d'administration web, tâches de maintenance connues).\nProcessus de déploiement et scripts d'exploitation lancés depuis le serveur web.\nSupervision applicative qui exécute curl ou wget par conception.",
        "recommandation": "Isoler le serveur et collecter processus, commandes et connexions.\nIdentifier la requête HTTP à l'origine (corrélation avec les logs web).\nLimiter les droits du compte du serveur web et interdire l'exécution de commandes via des profils de sécurité (AppArmor, SELinux).",
        "impact": "Le serveur web exécute des commandes de l'attaquant : signe quasi certain d'une exploitation ou d'une webshell, avec un accès direct au système.",
    },
    "DET-034": {
        "exclusions": "Utilisateurs qui se trompent de mot de passe puis réussissent (ajuster le seuil).\nPasserelles NAT d'entreprise (nombreux utilisateurs derrière une même IP).\nOutils de test de charge ou de supervision qui s'authentifient en boucle.",
        "recommandation": "Bloquer l'IP et limiter le débit sur le formulaire ou l'API (rate limiting).\nVérifier le compte qui a réussi : changement de mot de passe, MFA, historique d'activité.\nAjouter un CAPTCHA ou un MFA et un verrouillage progressif.",
        "impact": "Compte applicatif compromis par force brute ou credential stuffing : accès aux données des utilisateurs ou à des fonctions d'administration.",
    },
    "DET-035": {
        "exclusions": "Accès légitimes d'administrateurs depuis des IP connues (listes de réseaux d'administration).\nTests de sécurité et scans planifiés.\nSites qui publient volontairement ces ressources (documentation, endpoints de santé publics).",
        "recommandation": "Retirer l'accès public au chemin ou au fichier et vérifier ce qui a pu être lu.\nSi des secrets (clés, mots de passe, .env) étaient exposés : les révoquer et les renouveler.\nBloquer ces chemins au serveur web ou au WAF.",
        "impact": "Fuite de code source, de secrets ou de configuration : un seul fichier .env ou .git exposé peut donner un accès direct aux bases de données et au cloud.",
    },
    "DET-036": {
        "exclusions": "Applications front-end légitimes qui chargent beaucoup d'objets d'un même compte.\nExports et synchronisations planifiés par des comptes d'intégration.\nOutils de test de charge et de recette.",
        "recommandation": "Confirmer le contrôle d'accès côté serveur pour chaque objet (propriétaire de l'objet).\nBloquer le jeton ou le compte, limiter le débit et utiliser des identifiants non prévisibles.\nVérifier quelles données d'autres comptes ont été lues.",
        "impact": "Fuite de données d'autres utilisateurs (vulnérabilité BOLA / IDOR) : exposition de données personnelles ou métier à grande échelle, avec un risque réglementaire.",
    },
    "DET-037": {
        "exclusions": "Scanners de vulnérabilités et outils d'inventaire autorisés (IP à lister).\nOutils de supervision réseau et de découverte.\nServeurs de sauvegarde et d'administration qui se connectent à de nombreuses cibles.",
        "recommandation": "Si la source est interne : identifier le poste et isoler s'il n'est pas un scanner autorisé.\nSi externe : ne bloquer que si l'IP persiste ; vérifier les services exposés.\nSegmenter le réseau pour limiter ce qu'un poste compromis peut atteindre.",
        "impact": "Reconnaissance : l'attaquant liste les services atteignables pour choisir sa cible. En interne, c'est un signe de poste compromis qui cherche à se déplacer.",
    },
    "DET-038": {
        "exclusions": "Faux positifs de la liste de renseignement (IP partagées, CDN, hébergeurs légitimes) : vérifier la qualité de la source.\nPostes de recherche en sécurité et analystes qui consultent volontairement des sites malveillants.\nTests d'exfiltration planifiés.",
        "recommandation": "Identifier l'hôte et le processus à l'origine de la connexion ; isoler s'il s'agit d'un serveur ou d'un poste compromis.\nBloquer la destination sur le pare-feu, le proxy et le DNS.\nChercher d'autres hôtes qui contactent la même destination.",
        "impact": "Le poste ou le serveur communique avec une infrastructure d'attaque : commande à distance, téléchargement de malware ou fuite de données possible.",
    },
    "DET-039": {
        "exclusions": "Mises à jour logicielles, antivirus, supervision, NTP et services de synchronisation qui contactent un serveur à intervalle fixe.\nApplications SaaS qui interrogent régulièrement leur service.\nPostes d'enregistrement ou de pointage qui poussent des données périodiquement.",
        "recommandation": "Examiner le processus et la destination ; vérifier la réputation du domaine et l'ancienneté de son enregistrement.\nSi suspect : isoler l'hôte, bloquer la destination et analyser le processus.\nAjouter les services légitimes connus à la liste d'exclusion pour réduire le bruit.",
        "impact": "Possible canal de commande et de contrôle d'un malware : l'attaquant donne des ordres à intervalle régulier, de façon discrète.",
    },
    "DET-040": {
        "exclusions": "Services de sécurité qui utilisent le DNS (réputation, anti-spam, antivirus cloud).\nCDN et réseaux de diffusion avec de nombreux sous-domaines.\nOutils de supervision et DNSSEC / DKIM qui génèrent des requêtes TXT longues.",
        "recommandation": "Identifier l'hôte et le domaine interrogé ; bloquer le domaine au DNS et isoler l'hôte.\nAnalyser le processus qui émet les requêtes et vérifier l'exfiltration possible.\nForcer l'usage du résolveur interne et surveiller les domaines rares.",
        "impact": "Canal de commande ou d'exfiltration discret qui contourne le pare-feu : des données sortent encodées dans des requêtes DNS.",
    },
    "DET-041": {
        "exclusions": "Services volontairement publiés (SSH vers un bastion durci, VPN) clairement documentés.\nRègles temporaires de dépannage avec ticket et date de fin.\nFlux sortants légitimes vers des partenaires identifiés.",
        "recommandation": "Fermer ou restreindre l'accès (liste d'IP, VPN, bastion) et revoir la règle avec son propriétaire.\nVérifier les journaux de connexion sur le service exposé depuis l'ouverture.\nAuditer régulièrement les règles et supprimer celles qui n'ont plus de justification.",
        "impact": "Un service d'administration ou une base de données exposée sur Internet est attaqué en quelques minutes (force brute, exploitation). Les flux sortants interdits sont des voies d'exfiltration ou de propagation.",
    },
    "DET-042": {
        "exclusions": "Scans de sécurité autorisés qui déclenchent des signatures d'exploit sur des cibles de test.\nAlertes sur des cibles déjà patchées ou non vulnérables.\nConnexions sortantes vers des mises à jour légitimes.",
        "recommandation": "Isoler la cible et vérifier si la vulnérabilité visée existe sur elle.\nExaminer la connexion sortante (destination, processus) et bloquer la destination.\nPasser l'IPS en mode blocage pour les signatures d'exploit de gravité haute.",
        "impact": "Une exploitation non bloquée a probablement réussi : la cible est ensuite contrôlée à distance par l'attaquant, avec un accès au reste du réseau.",
    },
    "DET-043": {
        "exclusions": "Administrateurs réseau qui se trompent de mot de passe puis réussissent et changent la configuration pendant une maintenance planifiée (ticket).\nOutils de gestion et de sauvegarde de configuration réseau.\nAutomatisations d'infrastructure connues.",
        "recommandation": "Vérifier l'identité de l'administrateur et comparer la configuration avec la dernière version approuvée.\nRestaurer la configuration si elle est modifiée sans ticket ; changer les mots de passe de l'équipement.\nLimiter l'administration aux réseaux de gestion et imposer le MFA et des comptes nominatifs.",
        "impact": "Prise de contrôle d'un équipement du périmètre : l'attaquant peut ouvrir des flux, intercepter du trafic ou couper la journalisation, avec une persistance très discrète.",
    },
    "DET-044": {
        "exclusions": "Changements validés pendant une fenêtre de maintenance, avec ticket.\nRègles temporaires de dépannage avec date de fin.\nOutils d'orchestration de pare-feu qui appliquent des politiques approuvées.",
        "recommandation": "Comparer la modification au ticket ; annuler les règles trop larges et réactiver la journalisation et l'IPS.\nIdentifier le compte et vérifier ses autres actions.\nMettre en place une revue périodique des règles et une approbation à deux personnes.",
        "impact": "Affaiblissement du périmètre : une règle trop large ouvre le réseau à l'extérieur, désactiver les journaux ou l'IPS aveugle le SOC.",
    },
    "DET-045": {
        "exclusions": "Utilisateurs en déplacement qui se connectent depuis un nouveau pays ou un réseau mobile (liste de voyageurs).\nUtilisateurs qui se trompent de mot de passe avant de réussir.\nDouble session légitime (poste et téléphone) depuis le même pays.",
        "recommandation": "Contacter l'utilisateur ; sinon couper les sessions VPN et réinitialiser le mot de passe.\nVérifier l'activité du compte après la connexion (ressources internes atteintes).\nImposer le MFA sur le VPN et la restriction par pays et par appareil.",
        "impact": "Compte VPN compromis : l'attaquant entre directement dans le réseau interne avec les droits de l'utilisateur, sans passer par le périmètre.",
    },
    "DET-046": {
        "exclusions": "Pics prévisibles (soldes, publication de résultats, campagne marketing, lancement d'un produit).\nTests de charge planifiés.\nTrafic légitime d'un partenaire ou d'un crawler important.",
        "recommandation": "Activer la protection anti-DDoS (CDN, scrubbing) et limiter le débit par IP.\nIdentifier le type d'attaque (volumétrique, applicative) et les sources dominantes.\nPréparer le contact du fournisseur d'accès et un plan de continuité.",
        "impact": "Indisponibilité du service et perte de chiffre d'affaires ; peut aussi servir de diversion pendant qu'une autre attaque a lieu.",
    },
    "DET-047": {
        "exclusions": "Utilisateurs légitimes qui se connectent depuis un nouveau pays ou un VPN grand public (voyages).\nRègles de transfert créées par l'utilisateur vers une adresse interne ou un assistant validé.\nMigrations de boîte ou campagnes de départ planifiées (ticket).",
        "recommandation": "Révoquer les sessions et jetons, réinitialiser le mot de passe, vérifier les méthodes MFA.\nSupprimer la règle de transfert et relever les messages déjà envoyés à l'extérieur.\nBloquer le transfert automatique externe et surveiller les règles de boîte.",
        "impact": "Compromission de messagerie : l'attaquant lit les échanges en continu, prépare des fraudes au virement (BEC) ou récupère des données sensibles et des codes de réinitialisation.",
    },
    "DET-048": {
        "exclusions": "Règles personnelles légitimes (tri, déplacement vers un dossier), sans transfert externe.\nTransferts vers une adresse partenaire déclarée.\nDélégation ou secrétariat avec un accès prévu.",
        "recommandation": "Contacter l'utilisateur et supprimer la règle si elle n'est pas de lui.\nVérifier les connexions récentes du compte et les messages déjà transférés.\nInterdire le transfert automatique vers l'extérieur par une politique de messagerie.",
        "impact": "Fuite continue du courrier vers un tiers, ou dissimulation de messages (factures, alertes de sécurité) pour mener une fraude sans que la victime le remarque.",
    },
    "DET-049": {
        "exclusions": "Utilisateur qui valide par erreur après plusieurs notifications (téléphone en veille, mauvaise connexion).\nApplication qui renouvelle une session en boucle avec un MFA mal configuré.\nTests de MFA planifiés.",
        "recommandation": "Appeler l'utilisateur : a-t-il demandé la connexion ? Si non, révoquer les sessions et réinitialiser le mot de passe.\nActiver la correspondance de numéro (number matching) et limiter les demandes MFA.\nRechercher d'autres comptes ciblés depuis la même IP.",
        "impact": "L'attaquant qui connaît déjà le mot de passe use la patience de l'utilisateur jusqu'à obtenir la validation MFA : accès complet au compte malgré le second facteur.",
    },
    "DET-050": {
        "exclusions": "Enrôlement d'un nouvel appareil ou d'une méthode MFA par l'utilisateur lors d'un changement de téléphone (vérifier avec lui).\nProcessus d'arrivée de salariés, avec ticket du support.\nOpérations du support informatique documentées.",
        "recommandation": "Contacter l'utilisateur via un canal fiable, annuler les méthodes ajoutées et révoquer les sessions.\nRéinitialiser le mot de passe et imposer une nouvelle inscription MFA contrôlée.\nExiger une étape de vérification forte pour modifier les méthodes MFA.",
        "impact": "L'attaquant s'installe durablement : en ajoutant son propre second facteur, il garde l'accès même si le mot de passe est changé.",
    },
    "DET-051": {
        "exclusions": "Applications d'éditeurs connus validées par l'organisation (liste d'applications approuvées).\nOutils d'entreprise déployés par l'équipe informatique (messagerie mobile, CRM).\nConsentement donné par un administrateur pour toute l'organisation avec ticket.",
        "recommandation": "Examiner l'application (éditeur, droits demandés, date de création) et révoquer le consentement si inconnu.\nVérifier les accès réalisés avec le jeton de l'application.\nRestreindre le consentement utilisateur et exiger l'approbation d'un administrateur.",
        "impact": "L'application piégée lit le courrier et les fichiers sans mot de passe ni MFA, avec un jeton qui survit à un changement de mot de passe : accès persistant et discret.",
    },
    "DET-052": {
        "exclusions": "Attributions faites par l'outil de gestion des accès privilégiés (PIM) avec approbation.\nOpérations du service informatique avec ticket (arrivée d'un administrateur, délégation de boîte).\nDroits temporaires à durée limitée.",
        "recommandation": "Vérifier le ticket et l'acteur ; retirer le rôle ou le droit si non justifié.\nAuditer les actions du bénéficiaire depuis l'attribution.\nExiger l'élévation à la demande (just-in-time) avec approbation et limiter les administrateurs généraux.",
        "impact": "Un compte obtient un contrôle étendu sur la messagerie ou le tenant : lecture de toutes les boîtes, création de comptes, désactivation de la sécurité.",
    },
    "DET-053": {
        "exclusions": "Campagnes de sensibilisation et simulations de phishing de l'entreprise (expéditeurs et URL listés).\nNewsletters et notifications légitimes mal classées.\nClics d'analystes de sécurité qui examinent le message.",
        "recommandation": "Rappeler ou supprimer le message de toutes les boîtes et bloquer l'URL et l'expéditeur.\nContacter les destinataires qui ont cliqué : réinitialiser leur mot de passe, vérifier la session et les règles de boîte.\nAnalyser la pièce jointe ou la page de destination.",
        "impact": "Vol de mots de passe ou installation d'un malware chez plusieurs utilisateurs : premier pas vers une compromission de comptes, un vol de données ou un rançongiciel.",
    },
    "DET-054": {
        "exclusions": "Changements approuvés (ticket) de l'équipe sécurité ou de l'équipe d'administration du tenant.\nMises en œuvre planifiées de nouvelles politiques d'accès conditionnel.\nAutomatisations de configuration en mode contrôlé (infrastructure as code).",
        "recommandation": "Vérifier le ticket ; rétablir la politique ou l'audit ; identifier le compte à l'origine et ses autres actions.\nProtéger les rôles autorisés à modifier l'audit et l'accès conditionnel.\nAlerter aussi sur toute modification de configuration de sécurité dans le tenant.",
        "impact": "Affaiblissement de la sécurité du tenant ou perte de visibilité : l'attaquant peut ensuite agir sans être enregistré ou contourner le MFA.",
    },
    "DET-055": {
        "exclusions": "Procédures documentées d'urgence ou de configuration initiale du compte cloud (avec ticket).\nOpérations de facturation ou de recouvrement qui exigent le compte racine.\nTests de procédure de bris de glace planifiés.",
        "recommandation": "Vérifier qui a utilisé le compte racine et pourquoi ; sinon changer ses identifiants et clés immédiatement.\nImposer le MFA matériel sur le compte racine et sur tous les administrateurs, et ne pas créer de clés d'accès racine.\nAuditer les actions réalisées pendant la session.",
        "impact": "Le compte racine ou propriétaire contrôle tout le compte cloud et ne peut pas être restreint : prise de contrôle totale, fuite de données ou coûts frauduleux.",
    },
    "DET-056": {
        "exclusions": "Modification approuvée de la journalisation (changement de périmètre documenté).\nRéorganisation planifiée des journaux (nouvelle destination ou nouveau compte d'archivage).\nEnvironnements de test non productifs.",
        "recommandation": "Réactiver immédiatement la journalisation et vérifier ce qui n'a pas été enregistré pendant l'interruption.\nIdentifier l'identité à l'origine et auditer ses autres actions.\nProtéger la configuration des journaux (restrictions d'accès, journalisation centralisée dans un compte séparé).",
        "impact": "Perte de visibilité cloud : un attaquant qui coupe l'audit peut ensuite agir sans laisser de preuves, ce qui précède souvent une action destructive ou une exfiltration.",
    },
    "DET-057": {
        "exclusions": "Nouvelles clés d'accès créées pour un pipeline ou un service légitime, utilisées depuis ses IP connues (listes).\nOpérations d'un développeur en déplacement ou depuis un nouveau réseau.\nRotations de clés planifiées.",
        "recommandation": "Désactiver immédiatement la clé et lister les actions faites avec elle.\nVérifier l'origine de sa création (identité, session, IP) ; faire une rotation des secrets liés.\nPréférer des identités temporaires (rôles, fédération) aux clés statiques.",
        "impact": "Un identifiant cloud durable est créé puis utilisé par un tiers : accès persistant aux ressources, minage de cryptomonnaie ou exfiltration de données.",
    },
    "DET-058": {
        "exclusions": "Pipeline de déploiement d'infrastructure (Terraform, CloudFormation) avec rôle d'automatisation.\nAttributions approuvées avec ticket et durée limitée.\nProcessus d'arrivée d'un administrateur cloud.",
        "recommandation": "Comparer avec le ticket ; retirer la politique ou le rôle si non justifié.\nAuditer les actions du bénéficiaire et celles de l'acteur depuis l'attribution.\nAppliquer le moindre privilège, des permissions limitées dans le temps et des garde-fous de politique (SCP, Azure Policy).",
        "impact": "Un compte obtient des droits d'administration sur le cloud : possibilité de lire toutes les données, de créer des ressources et de désactiver la sécurité.",
    },
    "DET-059": {
        "exclusions": "Sites web statiques volontairement publics (documentation, assets) validés par l'équipe.\nRègles d'ouverture temporaires pour dépannage, avec ticket et date de fin.\nServices exposés derrière un bastion ou un load balancer prévu à cet effet.",
        "recommandation": "Fermer l'exposition (blocage de l'accès public, restriction des adresses sources) et vérifier les accès déjà faits.\nSi des données sensibles étaient publiques : mesurer la fuite et suivre la procédure de notification.\nActiver des politiques de prévention (blocage de l'accès public par défaut, règles de conformité).",
        "impact": "Fuite de données (stockage public) ou prise de contrôle de serveurs (ports d'administration ouverts à tous) : un grand nombre de compromissions cloud viennent de simples erreurs de configuration.",
    },
    "DET-060": {
        "exclusions": "Outils d'audit de configuration, de conformité (CSPM) et de découverte d'actifs autorisés.\nDéveloppeurs qui testent de nouveaux droits et obtiennent des refus.\nPipelines de déploiement avec des permissions en cours de mise au point.",
        "recommandation": "Identifier l'identité et la source de ces appels ; vérifier s'il s'agit d'un outil connu.\nSi suspect : désactiver l'identité, rechercher les appels qui ont réussi et l'origine de ses identifiants.\nRéduire les permissions de découverte accordées aux comptes qui n'en ont pas besoin.",
        "impact": "Un attaquant qui détient une clé volée cartographie les ressources et permissions pour choisir sa suite : c'est un signe précoce de compromission avant l'accès aux données.",
    },
    "DET-061": {
        "exclusions": "Sauvegardes, migrations et traitements analytiques planifiés (identités de service connues).\nOutils de réplication et de synchronisation de stockage.\nProjets de transfert de données approuvés, avec ticket.",
        "recommandation": "Identifier l'identité et la destination ; suspendre l'accès et révoquer ses clés si suspect.\nVérifier la sensibilité des données lues et les journaux d'accès du stockage.\nActiver l'alerte sur les accès anormaux, le chiffrement et la restriction d'accès par réseau.",
        "impact": "Exfiltration de données du stockage cloud : fuite d'informations sensibles, risque réglementaire (données personnelles) et extorsion.",
    },
}
