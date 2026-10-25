# Déployer et exploiter le CMS Calas Conseil

Le dépôt prépare une préproduction avec une application Astro SSR, PostgreSQL et un bucket S3 privé. Aucun projet Railway, abonnement, domaine, transport SMTP externe ou déploiement public n’a été créé par cette livraison. Les comptes d’exploitation doivent appartenir à Calas Conseil. La validation de Sara et Agnès et la relecture finale restent indispensables avant ouverture au public.

## Démarrage local

Utiliser Node **24.19.0**, pnpm **11.25.0** et Docker Desktop. Depuis la racine du dépôt :

```powershell
pnpm install --frozen-lockfile
pnpm cms:prepare
docker compose up -d --wait
pnpm db:migrate --apply
node scripts/media-storage-setup.mjs --local
pnpm content:seed --dry-run
pnpm content:seed --apply
pnpm auth:bootstrap
pnpm dev
```

La préparation crée les secrets locaux dans les fichiers `.env` ignorés par Git. Elle ne crée aucun compte, n’envoie aucun email et ne modifie aucun contenu. Avant le bootstrap, renseigner `INIT_ADMIN_EMAIL`, `INIT_ADMIN_NAME` et `INIT_ADMIN_PASSWORD` (12 caractères minimum) dans l’environnement privé du processus, sans les placer dans l’historique du terminal. Retirer ces variables ensuite. Le bootstrap refuse une base contenant déjà un compte ; les accès suivants passent par les invitations. Vérifier l’email puis activer TOTP, comme décrit dans [CMS.md](CMS.md). Mailpit est accessible sur `http://127.0.0.1:18025` ; aucun message de cette boîte ne part sur Internet.

Le seed crée seulement les contenus absents et conserve les modifications existantes. Pour une recette locale des pages issues du cahier des charges, `pnpm content:seed --apply --publish-initial` est une option explicite ; ne pas la placer dans une installation, une compilation ou un démarrage. Passer `CONTENT_MODE=database` dans `apps/web/.env` pour lire les versions publiées de PostgreSQL. `demo` reste un mode de recette choisi, jamais un repli après panne.

Arrêter les services locaux avec `docker compose stop`. Ne pas supprimer les volumes PostgreSQL/MinIO pour une simple relance. Ne pas reconstruire `dist` tant qu’un serveur de recette utilise ses fichiers.

### Stockage S3 de recette

L’ancienne image communautaire `minio/minio` n’est plus téléchargeable anonymement depuis les registres vérifiés le 25 octobre 2026. Le [dépôt officiel](https://github.com/minio/minio) est archivé et décrit désormais une distribution depuis les sources. Le service `storage` de Compose compile donc `infra/minio/Dockerfile`, uniquement pour les tests locaux et la CI. Aucun changement du fournisseur S3 de production n’est imposé.

La source correspond au [tag officiel RELEASE.2025-09-07T16-13-09Z](https://github.com/minio/minio/tree/RELEASE.2025-09-07T16-13-09Z), dont le commit réel est `07c3a429bfed433e49018cb0f78a52145d4bedeb`. L’image précédemment présente sur le poste annonçait ce numéro de version mais une autre révision dans ses labels (`32d8e520…`), introuvable dans le dépôt public : aucune identité des sources ou des binaires avec cette ancienne image n’est revendiquée. La nouvelle recette utilise la version officielle vérifiable et fait l’objet d’un nouveau test S3.

Le SHA-256 de l’archive est vérifié par Docker avant compilation ; Go 1.24.13 et Alpine 3.24.3 sont verrouillés par digest public. Les modules utilisent `go.sum` et `-mod=readonly`, sans modification du code amont. Le binaire porte un suffixe `calas-local` pour identifier cette construction. L’archive source, sa licence AGPL et la recette de construction restent dans `/usr/share/minio-source/` dans l’image.

Le premier `docker compose up -d --wait` prend plusieurs minutes pour télécharger et compiler les dépendances ; les lancements suivants réutilisent les couches locales. La CI sépare explicitement la compilation et le démarrage pour identifier un incident de téléchargement. La santé HTTP est vérifiée avant les tests S3 ; les ports restent liés à `127.0.0.1` et les volumes locaux ne sont pas supprimés. Les digests PostgreSQL et Mailpit ont été vérifiés auprès de leurs registres publics et restent inchangés.

Vérification exécutée : le [run Linux 40183929033](https://github.com/Paul-Berdier/Calas/actions/runs/40183929033), commit `afdf2a6e749c52d06ccc62b4543c9d9b1f542f1c`, a compilé cette source, attendu la santé des services, créé le bucket privé et réussi la suite d’intégration PostgreSQL/S3. Ce résultat provient de GitHub Actions sous Ubuntu 24.04. L’ancienne instance MinIO du poste et ses volumes n’ont pas été remplacés pour ce test ; aucun second test local de cette nouvelle image n’est revendiqué.

Cette version historique sert à reproduire une recette, elle ne constitue pas un service de stockage de production maintenu. Le déploiement final doit utiliser le bucket S3 privé et le fournisseur approuvés par Calas Conseil, avec maintenance et sauvegardes configurées.

## Construire et lancer l’application

```powershell
pnpm typecheck
pnpm lint
pnpm test:cms-local
pnpm test:domain
pnpm build
pnpm start
```

Le build génère les ressources PDF.js et OCR français/anglais dans les assets publics. Le site public ne charge pas ces moteurs. La compilation et le démarrage ne migrent pas la base, ne créent pas de bucket, n’importent et ne publient rien.

L’entrée SSR est `apps/web/dist/server/entry.mjs`. Le processus doit démarrer depuis `apps/web`, avec `HOST=0.0.0.0` sur l’hébergeur et son `PORT`. Le serveur Node sert les pages et les assets ; les uploads restent dans S3 et les données dans PostgreSQL. Aucun volume de médias sur le disque éphémère de l’application n’est nécessaire. [Adaptateur Node officiel Astro](https://docs.astro.build/en/guides/integrations-guide/node/).

## Image Docker

Le `Dockerfile` comporte des étapes séparées pour la construction et les dépendances de production. Le processus final utilise l’utilisateur non privilégié `node`. Les sources de test, `.env`, sauvegardes, captures et caches locaux sont exclus du contexte par `.dockerignore`. Aucun secret n’est un argument de compilation.

```powershell
docker build --tag calas-cms:recette --build-arg SITE_URL=https://preproduction.example.invalid .
```

Remplacer l’origine d’exemple par l’URL exacte approuvée de la préproduction. `SITE_URL` est le seul argument public nécessaire au build ; le fournir également au runtime. Astro compile les canonicals et l’hôte de confiance avec cette valeur. Un changement de domaine nécessite donc une nouvelle image.

Le conteneur attend les secrets au runtime par le gestionnaire de variables de l’hébergeur. Un fichier temporaire `--env-file` peut servir sur un poste maîtrisé ; il doit rester privé, hors Git et hors image. L’image finale ne contient pas les outils de migration ou de sauvegarde : exécuter ces commandes explicitement depuis le dépôt verrouillé, sur le poste d’exploitation ou un job d’administration autorisé.

## Variables par environnement

`apps/web/.env.example` est l’inventaire de référence. Ne jamais donner de préfixe `PUBLIC_` aux identifiants de base, clés S3, secrets Better Auth ou SMTP.

| Variables | Utilisation |
| --- | --- |
| `SITE_URL`, `BETTER_AUTH_URL` | Même origine exacte, HTTPS sur l’hébergement ; `SITE_URL` est aussi fourni au build. |
| `SITE_ENV` | `development`, `staging` ou `production`. La préproduction reste désindexée. |
| `CONTENT_MODE` | `database` pour le CMS ; `demo` seulement pour une recette explicite. |
| `HOST`, `PORT` | Adresse d’écoute et port fournis par l’hébergeur. |
| `DATABASE_URL`, `DATABASE_POOL_MAX` | Connexion PostgreSQL et taille du pool. Commencer avec 10 connexions par instance et respecter le budget de la base. |
| `BETTER_AUTH_SECRET` | Secret aléatoire d’au moins 32 caractères ; conserver séparément sa copie de récupération. |
| `CONTACT_SIGNING_SECRET` | Secret aléatoire indépendant d’au moins 32 caractères pour le formulaire et ses protections. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` | Endpoint HTTPS du service de stockage, région et nom du bucket privé. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Identifiants limités au bucket de cet environnement. |
| `S3_FORCE_PATH_STYLE` | `true` pour MinIO local ; choisir selon les exigences du fournisseur et vérifier la connexion. |
| `TRUST_RAILWAY_PROXY` | `false` par défaut ; `true` uniquement avec l’origine exclusivement accessible par le proxy Railway vérifié. |
| `AUTH_MAIL_TRANSPORT` | `local` pour Mailpit en développement, `smtp` pour un transport externe autorisé. |
| `AUTH_SMTP_HOST`, `AUTH_SMTP_PORT`, `AUTH_SMTP_FROM` | Mailpit local uniquement. Ne pas conserver ces réglages de développement en production. |
| `MAIL_TRANSPORT` | `simulation` en recette locale, `smtp` pour le formulaire effectivement raccordé. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Transport SMTP commun aux emails de compte et au formulaire. |
| `SMTP_TO` | Destinataire approuvé du formulaire, indépendant des emails de compte. |
| `ALLOW_REAL_EMAIL` | `false` jusqu’à autorisation explicite d’envoi réel ; `true` requis pour le raccordement externe. |
| `CONTACT_RATE_LIMIT` | Nombre de demandes autorisées par fenêtre de quinze minutes, 5 par défaut. |
| `BACKUP_ENCRYPTION_KEY` | Clé base64 de 32 octets, nécessaire au poste de sauvegarde, conservée hors des archives. |

Séparer totalement les bases, buckets, identifiants, secrets de session et destinations de courrier entre recette et production. La désindexation n’est pas un contrôle d’accès : restreindre aussi l’accès réseau à la préproduction lorsqu’elle contient des données privées.

## Raccordement Railway après autorisation

1. Choisir explicitement le compte, l’environnement, la région et le budget. Créer les ressources uniquement après accord. Le dépôt ne suppose aucun projet préexistant.
2. Configurer une application depuis la racine du dépôt. `railway.json` sélectionne le Dockerfile, une instance, le contrôle `/api/ready/`, un délai de démarrage de 120 secondes et trois tentatives de redémarrage après panne. Ne pas ajouter de seed à une commande de pré-déploiement. [Dockerfiles Railway](https://docs.railway.com/builds/dockerfiles) et [schéma de configuration officiel](https://railway.com/railway.schema.json).
3. Raccorder PostgreSQL 17 sur le réseau privé, avec un compte applicatif limité. Employer TLS pour une connexion distante exposée et vérifier le certificat ; ne pas désactiver sa validation pour contourner une erreur.
4. Raccorder un bucket S3 privé dédié et vérifier ses permissions. Ne pas activer de lecture publique, de CORS navigateur ou de domaine public de médias : l’application sert les fichiers par son proxy autorisé. Les clés restent exclusivement serveur. [Stockage S3 Railway](https://docs.railway.com/storage-buckets).
5. Injecter la configuration et les secrets. Définir l’origine HTTPS exacte avant construction. Le Dockerfile déclare `ARG SITE_URL` afin que Railway puisse lui fournir cette variable publique.
6. Sauvegarder, puis appliquer les migrations explicitement avec la même révision du dépôt. Le premier seed et le bootstrap administrateur restent des actions distinctes. Contrôler `pnpm cms:check --services` avant ouverture.
7. Démarrer l’image, vérifier la disponibilité, puis refaire une recette sur l’URL HTTPS réelle : login, email, MFA, preview, publication locale à cet environnement, médias privés, PDF autorisé, dépublication et restauration. Les contrôles réalisés sur MinIO/Mailpit ne remplacent pas ce raccordement.
8. Connecter le domaine final et activer `SITE_ENV=production` seulement après validations métier. Vérifier certificat, canonicals, sitemap, contact, désindexation de l’administration et en-têtes sur le domaine réel.

Les accès S3 applicatifs doivent être bornés aux opérations nécessaires sur ce bucket : lecture, écriture, suppression d’objets et lecture de son inventaire. La création de buckets appartient à l’exploitation. `media-storage-setup.mjs --local` refuse un endpoint distant.

## Origine, proxy et débit

Railway documente `X-Real-IP` comme adresse distante, `X-Forwarded-Proto` comme protocole et `X-Forwarded-Host` comme hôte original. Notre confiance dans `X-Real-IP` est conditionnée à `TRUST_RAILWAY_PROXY=true`. L’accès direct au processus doit alors être fermé : un client joignant directement Node pourrait fabriquer cet en-tête. Avec l’option désactivée, les en-têtes fournis par le navigateur ne deviennent pas une identité de limitation. [Spécifications réseau Railway](https://docs.railway.com/networking/public-networking/specs-and-limits).

Les origines autorisées restent exactes, sans wildcard. Les mutations de l’administration et de l’authentification contrôlent l’origine et utilisent les sessions HttpOnly. Les réponses privées, aperçus et médias privés ne sont pas mis en cache. Ne pas ajouter un cache de proxy qui contourne ces en-têtes.

Les compteurs et l’idempotence du contact sont mutualisés dans PostgreSQL, comme la protection des opérations administratives. Le corps du contact est borné à 64 Kio ; les endpoints médias vérifient leur flux et leur format, sous la limite générale de 22 Mio du serveur. Le moteur PDF s’exécute dans le navigateur ; la validation serveur reste obligatoire. Voir [MEDIA.md](MEDIA.md).

## Santé et surveillance

- `/api/health/` : processus HTTP vivant, sans lecture des contenus.
- `/api/ready/` : configuration, schéma PostgreSQL et bucket joignables ; réponse générique 503 en cas d’échec, sans identifiant sensible. Ce contrôle ne livre aucun brouillon et n’envoie pas d’email.
- Le healthcheck Docker utilise la vivacité ; Railway attend la disponibilité avant d’activer une nouvelle instance.

Le healthcheck de déploiement n’est pas une surveillance continue. Prévoir, après accord d’exploitation, des contrôles externes périodiques de la disponibilité, des erreurs et des sauvegardes, avec un destinataire d’alerte identifié. Contrôler l’arrêt propre et les connexions PostgreSQL lors des redémarrages. Ne pas enregistrer les corps des formulaires, les mots de passe, les cookies ou les liens de récupération dans les journaux.

## SMTP et délivrabilité

Le transport local vérifié est Mailpit. Il capture les invitations, vérifications et réinitialisations sans distribution externe. La simulation du formulaire valide son parcours mais ne démontre aucune délivrabilité.

Pour raccorder un fournisseur approuvé, configurer le transport authentifié, l’expéditeur autorisé et les enregistrements SPF, DKIM et DMARC demandés. Le visiteur du formulaire est placé en `Reply-To`, jamais usurpé en expéditeur. Vérifier réception, réponse, classement en indésirables, liens HTTPS et expiration des jetons avec une boîte de recette autorisée ; aucun test à Sara sans instruction explicite.

Documenter le fournisseur, ses traitements, la rétention des emails et leur suppression. L’idempotence applicative ne garantit pas une livraison SMTP exactement une fois lorsque le serveur accepte un message puis perd son accusé de réception. Reprendre manuellement une livraison incertaine plutôt que d’affirmer qu’aucun email n’a été envoyé.

## Sauvegarde, mise à jour et retour arrière

La procédure complète se trouve dans [BACKUP.md](BACKUP.md). `pnpm content:export` chiffre ensemble le dump PostgreSQL, les comptes, l’historique et les objets S3, y compris les versions de fichiers conservées. Une sauvegarde locale seule ne suffit pas : prévoir une copie chiffrée dans un autre domaine de panne, une rétention approuvée, la clé séparée et un contrôle périodique de restauration.

Avant une migration : exporter, vérifier l’archive, tester la nouvelle version dans une base et un bucket isolés, puis appliquer les migrations explicitement. `pnpm content:import <archive> --confirm-empty` refuse une destination non vide et ne cible pas la production. Ne jamais exécuter de reset de base pour déployer.

Pour revenir en arrière, redéployer le code précédent seulement si le schéma reste compatible. Sinon restaurer dans de nouvelles ressources, vérifier puis faire autoriser la bascule. Conserver `BETTER_AUTH_SECRET` lors d’un transfert normal : il protège les secrets MFA en base. Après compromission, préparer séparément rotation, révocation des sessions et récupération des accès. Renouveler les clés S3/SMTP sans les placer dans Git et tester les nouvelles avant révocation des anciennes.

Le suivi d’exploitation doit couvrir mises à jour Node/dépendances, migrations, disponibilité des sauvegardes, espace PostgreSQL/S3 et nettoyage des objets de médias en attente. Les anciens médias référencés par l’historique ne sont pas supprimés arbitrairement.

## État de vérification

Les parcours CMS, PDF, Tiptap, médias privés, SMTP local et sécurité Better Auth ont été exécutés avec PostgreSQL 17 et MinIO/Mailpit locaux. La sauvegarde/restauration sur ressources isolées est décrite dans `BACKUP.md`. Les rapports se trouvent dans `artifacts/custom-cms/`.

Une image Linux de recette, incluant le chargement différé de l’authentification pour la preview, a été construite puis exécutée avec un système de fichiers en lecture seule et l’utilisateur `node` (UID 1000). Le smoke a confirmé Node 24.19.0, la génération WebP par Sharp natif, l’accueil en mode démo explicite, la vivacité 200 et la disponibilité 503 sans configuration privée. Le message de démarrage a également confirmé le chargement du logger Astro JSON filtré. Aucun fichier `.env` ni source applicative n’était présent dans cette image. Le conteneur de recette a été arrêté automatiquement. Le rapport `artifacts/custom-cms/docker-local-smoke-report.json` contient l’identifiant exact de l’image et les empreintes vérifiées des sources clés.

Ce contrôle local précède le dernier ajustement de l’écran de sécurité concernant une session trop ancienne (`SessionNotFresh`) ; il ne valide pas cette modification ultérieure. Le job CI `container` reconstruit l’image et exécute le même smoke pour la révision du run. Consulter le résultat de la CI de la révision livrée, puis refaire ce contrôle après tout nouveau build destiné à l’hébergement :

```powershell
docker build --tag calas-cms:local-check --build-arg SITE_URL=http://localhost:4321 .
node scripts/docker-smoke-check.mjs
```

La révision applicative finale `48ade34a`, incluant le correctif de fraîcheur des sessions, a ensuite été reconstruite et vérifiée dans le job `container` de la [CI 40186258008](https://github.com/Paul-Berdier/Calas/actions/runs/40186258008). Ses cinq groupes passent ; le rapport correspondant est `artifacts/custom-cms/docker-smoke-report.json`. Le job `validate` a également vérifié les services privés et tous les parcours authentifiés sur cette révision.

Ce test utilise uniquement le port loopback 14321 et aucun secret, serveur de données ou transport de courrier. Il ne remplace pas la recette d’une image raccordée à ses services privés.

La préparation Docker/Railway ne constitue ni un déploiement Railway testé, ni une validation de domaine, ni un test SMTP externe. Les raccordements et leur recette restent à réaliser avec les accès et autorisations correspondants.
