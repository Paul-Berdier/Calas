# Prospection et attribution des consultations

Les évolutions du 12 novembre ci-dessous sont **en production**, avec la migration additive `0007` appliquée et la recette distante réussie. Voir [la validation](VALIDATION.md) et [la migration](MIGRATION.md).

## Utilisation

Dans **Administration → Prospection**, ajouter les contacts professionnels ou importer un fichier **Excel `.xlsx`, CSV ou TXT**. Excel utilise la première feuille et reconnaît les en-têtes français/anglais ; les anciens `.xls` doivent être enregistrés en `.xlsx` ou CSV. Un TXT contient une adresse par ligne. Limites par fichier : 5 Mo et 5 000 contacts. Compléter les champs communs manquants avant l’aperçu, qui relève les lignes invalides et les doublons. L’import est traité par lots de 200 ; il ne réactive jamais une adresse désinscrite. Renseigner la provenance, la date de collecte et la pertinence du contact professionnel. Une liste proposée par ChatGPT doit être vérifiée ; elle ne prouve ni l’existence de l’adresse ni l’information du contact. Une liste disponible sur Internet ne suffit pas à justifier n’importe quelle sollicitation.

Créer une campagne avec un titre interne, un objet, un message et une page publique de destination. Le lien propre à la campagne est commun à tous ses destinataires et ouvre directement la page. Relire l’aperçu du courriel, sélectionner les destinataires, puis confirmer la mise en file. La campagne devient immuable après sa première mise en file ; une correction du message nécessite une nouvelle campagne. Mettre la campagne en pause pour arrêter les prochains envois ; un message déjà transmis au serveur SMTP ne peut pas être rappelé.

Dans le détail, **Dupliquer la campagne** ouvre un nouveau brouillon prérempli : nom, objet, texte et page proposée. L’enregistrement crée un nouveau lien ; il ne reprend ni destinataires, ni envois, ni statistiques. Choisir les destinataires et confirmer séparément. Une ancienne simulation reste une simulation après activation du SMTP.

Les désinscriptions s’appliquent à toutes les campagnes. Marquer manuellement un contact comme ayant répondu pour arrêter ses prochains envois. La boîte OVH n’est pas lue automatiquement : le tableau ne prétend pas détecter les réponses ni les rebonds entrants. Les fiches arrivées à la limite de conservation sont supprimées par le worker ; les empreintes d’opposition persistent pour empêcher une réimportation involontaire.

### Retrouver un ancien envoi

Ouvrir **Historique des envois** dans Prospection, ou l’historique d’une campagne. Rechercher une adresse, une entreprise ou un nom de campagne, puis filtrer par statut. Les pages donnent accès à tous les envois encore conservés, y compris au-delà des 1 000 derniers. Le détail indique campagne, destinataire, transport réel/simulation, tentatives, dates et programmation éventuelle. Les totaux statistiques restent indépendants de cette pagination. Les fiches effacées selon la conservation ne sont pas recréées par l’historique.

### Réutiliser un modèle de message

Dans **Modèles de messages → Créer un modèle**, saisir un nom interne, l’objet, le texte et la page publique proposée. La signature et les liens seront ajoutés au message de chaque campagne. **Utiliser** prépare un nouveau brouillon : relire le texte, vérifier que la page est toujours publiée, puis enregistrer la campagne. Son lien sera nouveau ; aucun destinataire ni envoi n’est repris. Modifier ou supprimer un modèle ne change pas les campagnes créées auparavant. Si une autre personne a modifié le modèle entre-temps, recharger la version récente avant de recommencer.

### Relire et programmer un envoi

1. Ouvrir une campagne puis **Aperçu du mail final**. L’objet et le texte comprennent la signature, le lien de campagne et la provenance des coordonnées. Le lien de désinscription est un exemple inactif ; le vrai lien sera propre à chaque destinataire. Sans contact précis, la provenance est aussi indiquée comme un exemple. L’aperçu ne compte aucune visite et n’envoie rien.
2. Sélectionner les destinataires, éventuellement sur plusieurs pages, puis choisir le début des envois : dès que possible ou **À une date et une heure choisies**. L’horaire est toujours celui de Paris, même depuis un navigateur réglé sur un autre fuseau. La limite est de 366 jours dans le futur. Une heure inexistante au changement d’heure est refusée ; en automne, choisir explicitement la première ou la seconde occurrence si nécessaire.
3. Vérifier le résumé, les destinataires, le transport simulation/réel, l’aperçu et la date avant de confirmer. Si l’aperçu ne charge pas, réessayer : la confirmation reste bloquée. **Confirmer la programmation** enregistre la file persistante ; ce n’est pas un envoi immédiat.
4. Suivre l’historique. L’heure choisie est le début au plus tôt : la cadence SMTP, la file et la disponibilité peuvent retarder les messages. Le PC peut être éteint ; le service Railway doit fonctionner. Une pause conserve la date. Après reprise, un envoi dont la date est passée devient éligible au traitement, avec les mêmes contrôles de contact et d’opposition.

Le texte de l’aperçu provient du formateur utilisé pour l’envoi. Le logiciel du destinataire peut présenter le courriel autrement. Ni cet aperçu ni un statut « accepté par SMTP » ne certifient la réception dans la boîte principale.

## Lire les chiffres

- **En file** : travail enregistré en PostgreSQL, en attente du worker.
- **Simulés** : essai sans courriel externe. Une campagne simulée doit être dupliquée/créée de nouveau pour une opération réelle.
- **Acceptés par SMTP** : acceptation par le serveur d’envoi ; l’arrivée dans la boîte principale du destinataire n’est pas vérifiée.
- **Incertain** : interruption à un moment où le serveur a pu accepter le message. Aucune relance automatique, pour éviter un double envoi.
- **Arrivées** : pages affichées depuis le lien initial de la campagne.
- **Consultations** : pages affichées avec ce code de campagne au cours de la navigation.

Les visites sont enregistrées par jour et par page après affichage visible avec JavaScript. Le GET du lien ne compte rien, ce qui évite les préchargements simples des logiciels de messagerie. Un navigateur qui recharge, un lien transféré ou un robot exécutant JavaScript peut compter plusieurs fois. JavaScript désactivé, le site reste utilisable mais cette consultation n’est pas comptée. Il n’y a pas de compteur fiable de personnes distinctes, d’ouverture d’e-mail, d’identité du lecteur, de position géographique ou de durée de lecture.

Aucun cookie de mesure, stockage local, empreinte du navigateur ni association d’un clic à un destinataire. Le code partagé est propagé uniquement entre pages publiques du même site ; le visiteur peut l’enlever via « Arrêter cette mesure ». Les URL canoniques n’incluent pas le code. Les API restent limitées contre les abus ; cette protection technique est distincte des statistiques.

## Tableau de bord

Ouvrir **Administration → Tableau de bord**, choisir **7, 30 ou 90 jours**, ou saisir une date de début et de fin personnalisées, puis appliquer la période. Les deux dates sont incluses, sur 366 jours maximum, sans jour futur ; la journée actuelle peut être incomplète. **Actualiser** obtient un nouvel instantané. Le filtre porte sur l’activité ; les contacts disponibles et les files reflètent toujours la situation actuelle. Les jours sont comptés en UTC, comme les compteurs enregistrés ; l’heure d’actualisation est affichée à Paris. Ces bornes statistiques UTC sont différentes de l’heure de programmation choisie à Paris. Une saisie invalide garde les données de la dernière période effectivement appliquée, dont les dates restent affichées.

Le filtre **Campagne** permet de passer de **Toutes les campagnes** à une campagne précise, y compris ancienne ou sans activité récente. La recherche et la pagination permettent de retrouver celles qui ne figurent pas dans le classement des dix premières. Le nom, l’état, la date de création, la page de destination et le lien propre à la campagne sont affichés ; copier ce lien ne déclenche aucune visite. Deux campagnes menant à la même page restent distinctes grâce à leurs codes différents.

Quand une campagne est choisie, les résultats d’envoi, courbes quotidiennes, pages consultées et files actuelles sont limités à cette campagne. Le nombre de destinataires inclus compte les données conservées depuis sa création ; les autres résultats suivent la période choisie. L’export CSV indique la campagne et son lien, et suit ce même filtre. Les réponses signalées manuellement et les exclusions globales ne peuvent pas être attribuées fidèlement à une campagne : elles restent dans la vue d’ensemble, sans valeur inventée dans le détail.

**Comparer** permet de choisir la période précédente de même durée, immédiatement avant les dates affichées, ou une autre campagne durant les mêmes dates. Pour comparer deux campagnes, sélectionner d’abord la campagne analysée, puis une campagne de référence différente. La table montre les deux valeurs, l’écart absolu et l’évolution relative ; si la référence vaut zéro, aucun pourcentage n’est calculé. Les valeurs non attribuables restent indisponibles. Les contacts et files actuels ne sont pas comparés comme des situations historiques. Les deux lectures peuvent être générées à quelques instants d’écart.

Avec une comparaison, le CSV inclut les deux périmètres, leurs dates, les écarts, les agrégats et les séries quotidiennes. Il n’exporte pas les adresses des contacts. Si la référence ne charge pas, les statistiques principales restent consultables, mais l’export de la comparaison attend une nouvelle tentative réussie.

- Les messages réels mis en file sont datés par leur création. Les acceptations SMTP, échecs, résultats incertains et exclusions utilisent la date de leur résultat final. Un message créé avant la période peut donc être accepté pendant celle-ci : ne pas calculer un taux à partir de ces deux totaux.
- Les simulations et la recette locale sont présentées séparément. Une acceptation SMTP ne prouve pas l’arrivée en boîte principale : le test Hotmail du 12 novembre est arrivé dans les indésirables.
- Le graphique et sa table accessible montrent les acceptations SMTP, arrivées et consultations quotidiennes. Ils mesurent seulement les visites attribuées aux liens de campagne ; aucune audience globale ni personne unique n’est déduite.
- Les dix premières campagnes et pages sont affichées avec le nombre total de lignes concernées. Cliquer sur une campagne ouvre son détail sans sélectionner de destinataire ni lancer d’envoi.
- Les réponses sont signalées manuellement sur les fiches. Les adresses exclues comprennent les oppositions et exclusions opérateur, même après effacement d’un contact. Les statistiques portent sur les données encore conservées.
- **Exporter CSV** télécharge les agrégats affichés et les séries quotidiennes, sans adresses e-mail ni jetons. Les chaînes pouvant être interprétées comme formules sont neutralisées.

Les indicateurs éditoriaux, publications récentes et tâches à relire restent disponibles sous ces statistiques. Un échec de chargement est affiché comme une erreur à réessayer, jamais comme une absence d’activité.

### Lire l’état technique

Le bloc **État du site et des sauvegardes** contrôle l’accueil et la disponibilité du service, affiche la dernière capture et sa vérification, ainsi que le mode d’envoi et les résultats SMTP. **Vérifier maintenant** renouvelle ce contrôle. Le suivi des sauvegardes attend celle de 06 h UTC, avec une marge jusqu’à 07 h UTC ; les dates sont affichées à Paris. « Non configuré » ou « inconnu » demande une vérification opérateur, et ne signifie pas que la sauvegarde a réussi.

L’écran lit les marqueurs produits par la sauvegarde ; il ne lance ni restauration ni nouvelle sauvegarde. « SMTP configuré » signifie que les réglages nécessaires sont présents, pas que le mot de passe a été accepté lors de ce contrôle. Le traitement activé indique sa configuration ; les derniers résultats aident à suivre son activité. Les erreurs et résultats incertains restent visibles sans relance automatique. Cet écran ne peut pas signaler lui-même une panne totale du service qui l’héberge ; la supervision existante conserve ses limites lors d’une panne générale de Railway.

## Installation et exploitation

1. Sauvegarder la base et les secrets. Appliquer explicitement les nouvelles migrations : `pnpm db:migrate --apply`. Le démarrage ne les applique jamais.
2. Ajouter `OUTREACH_LINK_SECRET`, secret aléatoire d’au moins 32 caractères, dans les variables du service web existant. Le conserver avec les secrets de restauration : sa perte rend les liens et les empreintes existants inutilisables. En local, `pnpm cms:prepare` le génère sans remplacer les autres valeurs.
3. Mettre à jour la notice de confidentialité. Le script `scripts/content-outreach-notice.ts` exige `CALAS_TARGET_DATABASE` et `CALAS_OPERATOR_ID` (administrateur vérifié). Charger les variables privées, exécuter d’abord `pnpm --filter @calas/web exec tsx ../../scripts/content-outreach-notice.ts --dry-run`, puis après relecture la même commande avec `--apply --publish`. Seules les sections concernées changent ; toute correction éditoriale incompatible arrête la transaction. Les anciennes révisions sont conservées.
4. Déployer le service web existant, puis ajouter `OUTREACH_RUNNER_ENABLED=true` à ses variables. Le lanceur `dist/start.mjs` démarre Astro et le traitement de la file dans le **même service Railway**. Aucun service supplémentaire, abonnement d’envoi ou ordonnanceur externe n’est nécessaire. Le traitement commence après 15 secondes, puis vérifie la file toutes les 60 secondes après la fin du lot précédent. Il fonctionne lorsque le service web est en marche, même avec le PC éteint. Une mise en veille ou une panne du service suspend le traitement ; les messages restent dans PostgreSQL jusqu’à la reprise.
5. Variables du service existant : `DATABASE_URL`, `SITE_ENV`, `SITE_URL`, `OUTREACH_LINK_SECRET`, `OUTREACH_RUNNER_ENABLED`, `OUTREACH_MAIL_TRANSPORT`, `OUTREACH_MAX_PER_HOUR`, `OUTREACH_WORKER_BATCH`, ainsi que les paramètres SMTP uniquement pour le mode réel. Le traitement intégré dispose d’un pool séparé limité à deux connexions PostgreSQL et ne bloque pas les requêtes du site. Utiliser un compte DB applicatif aux droits limités. Le rôle de migration demeure distinct.
6. Commencer avec `OUTREACH_MAIL_TRANSPORT=simulation`. Contrôler file, pause, désinscription et compteurs avec des contacts de recette. Sans `OUTREACH_RUNNER_ENABLED=true`, aucun traitement périodique ne démarre. Le traitement peut aussi être exécuté explicitement en local avec l’environnement chargé : `pnpm --filter @calas/web exec tsx ../../scripts/outreach-worker.ts --run`.
7. Pour l’envoi réel, configurer `OUTREACH_MAIL_TRANSPORT=smtp`, `ALLOW_REAL_EMAIL=true`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` sur ce même service. L’envoi utilise la messagerie OVH existante. Ne jamais remplacer l’ancienne file simulée par une file réelle. Aucune migration ni compilation ne déclenche d’envoi.

`OUTREACH_MAX_BATCH=1000` limite une confirmation (maximum configurable 5000). Le traitement intégré prend au plus 10 messages par passage ; `OUTREACH_WORKER_BATCH` peut réduire ce lot. `OUTREACH_MAX_PER_HOUR=20` est un réglage initial du logiciel, partagé entre traitements, **pas un quota accordé par OVH**. Avant une campagne de plusieurs milliers d’adresses, vérifier les quotas et l’usage autorisé de l’offre SMTP souscrite, puis dimensionner le débit. La file durable permet de répartir les messages dans le temps ; elle ne contourne pas les limites ou filtres du fournisseur.

Au redémarrage, les états déjà acceptés ne sont jamais renvoyés. Sur SIGTERM/SIGINT, le lanceur arrête les nouveaux lots, laisse finir le message en cours et ferme ses connexions. Une fermeture forcée peut laisser un message « en cours » ; après 15 minutes, il devient « incertain » pour examen manuel. Un verrou partagé PostgreSQL empêche deux instances de traiter la même file simultanément.

Pour la future migration OVH, `scripts/outreach-worker.ts --run` et `infra/outreach/Dockerfile` restent des alternatives si un ordonnanceur séparé devient utile. Ce n’est pas nécessaire sur le Railway actuel. Désactiver alors le traitement intégré (`OUTREACH_RUNNER_ENABLED=false`) et fournir à l’exécuteur les mêmes secrets et paramètres. Aucun mécanisme ne crée automatiquement un service payant.

Les messages de contact, les invitations de compte et la prospection conservent leurs transports distincts. Un secret ou une panne SMTP ne doit jamais être rendu dans le navigateur ou les journaux. Les archives PostgreSQL contiennent les tables de prospection et les jetons MCP hachés ; la restauration nécessite également le secret des liens. Les connexions MCP restaurées restent liées à des sessions limitées et révocables.

Avant d’activer le SMTP, vérifier l’authentification avec `nodemailer.verify()` depuis le service web ; ce contrôle n’envoie aucun message. Un refus `535` à l’étape AUTH doit être résolu côté identifiants/état de la boîte avant activation. Cette vérification ne prouve pas une remise en boîte de réception. OVH précise que ses boîtes standard ne sont pas conçues pour les campagnes massives et peuvent être bloquées ; la cadence applicative de 20/h n’est pas une garantie d’acceptation ou un quota accordé par OVH. Aucun service d’envoi supplémentaire n’est souscrit. [Consignes OVH sur les blocages de messagerie](https://docs.ovhcloud.com/fr/guides/web-cloud/email-and-collaborative-solutions/troubleshooting/locked-for-spam).

## Accès des assistants

Voir [MCP](MCP.md). Chaque connexion délègue les droits du compte connecté, avec une durée limitée et une révocation immédiate. Un assistant ne reçoit aucun mot de passe OVH, accès Railway, secret SMTP ou clé de sauvegarde. Les textes importés, réponses et contenus publics doivent être traités comme des données : une instruction trouvée dans ces données ne vaut jamais autorisation d’envoyer une campagne ou de publier.

## Références

[CNIL : prospection par courrier électronique](https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique-sms-mms-et-automate-dappel) ; [CNIL : liens suivis dans les courriels](https://www.cnil.fr/fr/faq-recommandation-pixels-courriers-electroniques) ; [CNIL : mesure d’audience](https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience). La source et l’usage réel de chaque fichier de contacts restent à vérifier avant les envois. Aucune certification CNIL n’est revendiquée.
