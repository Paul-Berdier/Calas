# Calas Conseil

Site éditorial Astro SSR avec administration propriétaire sous `/admin`, PostgreSQL/Drizzle, Better Auth, Tiptap, médias S3 privés et OCR local. Le frontend et ses textes existants sont conservés. Sanity a été remplacé ; aucun compte Sanity n’est nécessaire.

La version livrée est destinée à la recette. La production reste soumise à la validation de Sara et Agnès, aux informations juridiques et au raccordement de l’hébergement et du courriel. Aucun service payant n’a été créé et aucun email de test n’est envoyé à Sara.

## Démarrage local

Prérequis : Node **24.19.0**, pnpm **11.25.0**, Docker Desktop démarré. Depuis la racine :

```powershell
pnpm install --frozen-lockfile
pnpm cms:prepare
docker compose up -d --wait
pnpm db:migrate --apply
node scripts/media-storage-setup.mjs --local
pnpm content:seed --dry-run
pnpm content:seed --apply --publish-initial
```

`cms:prepare` complète les fichiers `.env` ignorés sans remplacer les valeurs existantes et génère des secrets aléatoires. Aucun compte n’est créé. Le seed ci-dessus publie explicitement les contenus initiaux **dans la recette locale seulement** ; il ne modifie jamais les documents déjà présents. Sans `--publish-initial`, il crée des brouillons.

Dans `apps/web/.env`, choisir `CONTENT_MODE=database`, `SITE_ENV=development`, et garder `SITE_URL` et `BETTER_AUTH_URL` identiques, normalement `http://localhost:4321`. Puis :

```powershell
pnpm cms:check --services
pnpm dev
```

Ouvrir [le site](http://localhost:4321/) et [l’administration](http://localhost:4321/admin/). Ne pas alterner `localhost` et `127.0.0.1` pour la connexion : une session est liée à son origine.

Le mode `CONTENT_MODE=demo` reste disponible pour une revue du frontend sans services. Il est explicite, interdit en production et ne sert jamais de repli silencieux en cas de panne PostgreSQL.

## Premier administrateur

Suivre [la procédure CMS](docs/CMS.md). La commande `pnpm auth:bootstrap` lit `INIT_ADMIN_EMAIL`, `INIT_ADMIN_NAME` et `INIT_ADMIN_PASSWORD` dans l’environnement privé du processus, refuse si un compte existe déjà, puis exige vérification de l’adresse et activation TOTP. Aucun mot de passe par défaut et aucune inscription publique.

Les courriels de développement arrivent dans [Mailpit local](http://localhost:18025/). Les autres collaborateurs sont invités depuis l’administration. Le [guide de Sara illustré](docs/GUIDE-SARA.md) présente la connexion, les pages, les images, l’import PDF, les brouillons, la publication et l’historique.

## Commandes principales

| Commande | Effet |
| --- | --- |
| `pnpm dev` | Astro local et préparation des fichiers OCR locaux |
| `pnpm build` / `pnpm start` | Compilation / serveur Node standalone |
| `pnpm typecheck` / `pnpm lint` | Contrôles Astro, TypeScript et ESLint |
| `pnpm test:cms-local` | Configuration, contenu initial, preview, rendu riche, médias/PDF |
| `pnpm test:domain` | Modèles métier et validation des médias |
| `pnpm test:integration` | PostgreSQL, médias S3, contact partagé et sauvegarde selon les variables de recette |
| `pnpm test` | Parcours publics Chromium/Firefox, accessibilité et budgets |
| `pnpm db:generate` / `pnpm db:migrate --apply` | Générer / appliquer explicitement les migrations |
| `pnpm cms:prepare` / `pnpm cms:check --services` | Configuration locale / vérification sans afficher les secrets |
| `pnpm content:seed --dry-run` | Inventaire des contenus initiaux, aucune écriture |
| `pnpm content:export` / `pnpm content:import … --confirm-empty` | Sauvegarde chiffrée complète / restauration isolée |

La compilation, le démarrage et le déploiement ne lancent ni migration, ni seed, ni publication. Les ports 4322/4324/4325 servent aux tests publics ; 4336 à la recette authentifiée. Ne pas reconstruire `dist` pendant qu’un test utilise ses chunks.

## Architecture et exploitation

Le public utilise uniquement les versions publiées. Les brouillons nécessitent une session vérifiée avec MFA et ne sont pas mis en cache. Publier est une opération distincte d’enregistrer ; restaurer ajoute une version sans réécrire l’historique. L’administration et le moteur PDF/OCR ne sont pas chargés sur les pages publiques.

Les images et PDF restent dans un bucket privé, servis par une route qui contrôle les droits. Un PDF devient téléchargeable seulement après publication et autorisation explicite. L’OCR français/anglais s’exécute dans le navigateur ; aucun fichier n’est téléversé avant confirmation de création.

Le contact conserve validation, contrôle d’origine, honeypot, simulation et SMTP. En mode base de données, limitation et idempotence sont partagées via PostgreSQL ; les messages ne sont pas journalisés. Un SMTP externe exige configuration et autorisation. Les services locaux sont liés à `127.0.0.1`.

- [Architecture et sécurité](docs/ARCHITECTURE.md)
- [CMS et accès](docs/CMS.md)
- [Médias et PDF](docs/MEDIA.md)
- [Sauvegarde/restauration](docs/BACKUP.md)
- [Déploiement Railway préparé](docs/DEPLOYMENT.md)
- [Guide de Sara](docs/GUIDE-SARA.md)
- [Migration et référence conservée](docs/MIGRATION.md)
- [Recette et limites](docs/RECETTE.md)
- [Validation éditoriale](docs/VALIDATION.md)
- [Sources métier](docs/SOURCES.md), [logo](docs/LOGO.md), [prestation et maintenance](docs/PROPOSITION.md)

Les résultats historiques et les résultats de cette migration sont distingués dans la recette. Un succès local ne vaut ni validation éditoriale ni test de l’infrastructure de production.
