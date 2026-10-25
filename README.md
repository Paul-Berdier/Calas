# Calas Conseil

Site vitrine éditorial en français : Astro SSR, TypeScript strict, Sanity Studio séparé, CSS sur mesure et animation SVG/GSAP. Le diagnostic RPS constitue le parcours prioritaire. La marque utilise **Calas Conseil**, avec un seul s.

La livraison est prévue pour une revue locale ou de préproduction. La publication dépend de la validation de Sara et Agnès. Le mode de démonstration est explicite ; aucun article inventé n'est publié sous leur nom et aucun email de test n'est envoyé à Sara.

## Démarrage local

Prérequis : Node **24.19.0** (contrainte compatible dans `package.json`) et pnpm **11.25.0**. Les dépendances sont épinglées et le lockfile doit être conservé. Depuis la racine du dépôt, sous PowerShell :

```powershell
pnpm install --frozen-lockfile
Copy-Item -LiteralPath apps/web/.env.example -Destination apps/web/.env
pnpm dev
```

Ouvrir l'URL locale indiquée par Astro, normalement [http://localhost:4321](http://localhost:4321). Garder `CONTENT_MODE=demo`, `SITE_ENV=development` et `MAIL_TRANSPORT=simulation` pour la première visite. Le mode simulation traite la demande côté serveur puis la détruit, sans envoi ni stockage du message. Pour reproduire une indisponibilité du transport, utiliser le mode de test `unavailable` puis redémarrer.

Les copies de `.env.example` ci-dessus sont destinées à un premier démarrage. Si un `.env` existe déjà, le conserver et ne compléter que les clés manquantes. Aucun secret ne doit être committé.

## Studio et contenu connecté

Les sources de l'interface d'édition sont présentes dans `apps/studio`. Le Studio nécessite un vrai projet Sanity détenu par Calas Conseil pour modifier et publier des données. La simple compilation ne démontre pas une connexion CMS fonctionnelle.

Après configuration du projet et du dataset de test dans les exemples d'environnement :

```powershell
Copy-Item -LiteralPath apps/studio/.env.example -Destination apps/studio/.env
pnpm dev:studio
```

Ouvrir l'URL donnée par Sanity, normalement [http://localhost:3333](http://localhost:3333). La procédure technique se trouve dans [docs/CMS.md](docs/CMS.md), et le parcours sans terminal destiné à Sara dans [docs/GUIDE-SARA.md](docs/GUIDE-SARA.md).

Les pages publiques utilisent la perspective `published`. La preview vérifie un secret Sanity avant d'émettre une session signée ; ses réponses sont privées et non indexables. Un paramètre `preview=true` ou un cookie arbitraire n'ouvre pas les brouillons. Les jetons privés restent côté serveur. Le mode connecté ne retourne jamais de faux contenu de démonstration lorsqu'un CMS est indisponible.

Le cache partagé public est prévu à 30 secondes, sans CDN Sanity supplémentaire. La publication réelle et le délai de visibilité doivent être mesurés après connexion et sur l'hébergement retenu. Aucun redéploiement manuel du frontend n'est nécessaire pour les pages éditables SSR.

## Commandes

| Commande | Usage |
| --- | --- |
| `pnpm dev` | Serveur Astro local |
| `pnpm dev:studio` | Interface Sanity locale |
| `pnpm cms:prepare` | Préparer les configurations locales sans connexion ni publication |
| `pnpm cms:check` | Signaler les réglages manquants sans afficher les secrets ; `--remote` pour vérifier ensuite la lecture API |
| `pnpm build` | Compilation du frontend Node standalone |
| `pnpm build:studio` | Compilation du Studio séparé |
| `pnpm preview` | Inspection locale du build Astro |
| `pnpm start` | Démarrage du serveur Node compilé |
| `pnpm typecheck` | Contrôles TypeScript et Astro |
| `pnpm lint` | Analyse statique des sources |
| `pnpm test:unit` | Tests unitaires pertinents |
| `pnpm test:cms-local` | Configuration, preview, images, PDF et contenus initiaux sans compte réel |
| `pnpm test` | Parcours Playwright |
| `pnpm test:visual` | Captures et contrôles visuels Playwright |
| `pnpm content:seed` | Initialisation explicite du dataset de test autorisé |
| `pnpm content:export` | Export de contenu selon la procédure CMS |
| `pnpm content:import` | Import volontaire dans l'environnement autorisé |

Les paramètres et garde-fous des trois commandes de contenu sont décrits dans `docs/CMS.md`. `pnpm content:seed --dry-run` prépare l'inventaire sans appel réseau. Une initialisation réelle crée seulement des brouillons absents, dans un dataset de test explicitement autorisé, sans écraser les modifications existantes. Ne jamais ajouter l'initialisation ou un import à la commande de build/déploiement.

## Organisation

```text
apps/web/            Application Astro, routes SSR, formulaire et preview
apps/studio/         Interface Sanity, structure éditoriale et schémas
assets/brand/        Sources vectorielles et géométrie du coquillage
apps/web/public/    Assets publics et variantes du logo
scripts/            Outils reproductibles d'assets et de contenu
tests/              Recette automatisée
docs/               Architecture, sources, édition, validation et exploitation
```

Le rendu initial contient les textes, chiffres et actions. Si le mouvement est autorisé, le logo se révèle progressivement depuis son noyau, ruban après ruban, de l’intérieur vers l’extérieur. Son bloc reste fixe, sans parallaxe. Sans JavaScript ou en mouvement réduit, le logo complet reste visible. Les portraits et les articles finaux restent absents jusqu'à fourniture et validation ; la présentation utilise les informations disponibles, sans faux visuel.

## Contact et exploitation

Le formulaire a besoin d'un transport SMTP authentifié pour une livraison réelle. Régler `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` et `SMTP_TO`. Le visiteur devient `Reply-To`, jamais l'expéditeur usurpé. Hors production, la destination reste un domaine de test, sauf autorisation explicite matérialisée par `ALLOW_REAL_EMAIL=true`.

Le contrôle de débit et l'idempotence utilisent une mémoire bornée par instance ; avant une exploitation sur plusieurs instances, prévoir une protection de débit commune en amont. Aucun corps de message n'est conservé dans les journaux applicatifs. La conservation réelle chez le prestataire email et dans la boîte destinataire doit être validée avec Calas Conseil.

La route `/api/health/` indique la santé du serveur. Déployer avec `HOST=0.0.0.0` et le `PORT` de la plateforme. Les instructions de mise en ligne, cache, sauvegarde et restauration figurent dans [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documents de livraison

- [Architecture](docs/ARCHITECTURE.md) : choix techniques et limites.
- [Sources et corrections](docs/SOURCES.md) : ODT, statistiques, terminologie et références.
- [Validation](docs/VALIDATION.md) : revue des pages prioritaires, contenus manquants et conditions de publication.
- [Guide de Sara](docs/GUIDE-SARA.md) : édition graphique, brouillons et publication.
- [CMS](docs/CMS.md) : raccordement, sécurité et opérations sur le contenu.
- [Logo](docs/LOGO.md) : source, variantes et mouvement.
- [Déploiement](docs/DEPLOYMENT.md) : Node, transport email, sauvegarde et restauration.
- [Proposition](docs/PROPOSITION.md) : réalisation, hébergement et maintenance séparés, sans tarif accepté.

Les vérifications effectivement réalisées sont à lire dans le compte rendu de recette livré avec les captures. Les parcours Sanity réels, la délivrabilité SMTP, les mentions juridiques finales et l'autorisation de publication restent distincts de la validation technique locale. Aucune disponibilité ou propriété du domaine `calasconseil.fr` n'est présumée.

Le Studio comprend **Importer un PDF** : extraction locale ou OCR français/anglais des scans, aperçu et création d’un nouvel article en brouillon avec PDF téléchargeable. La relecture, l’auteure et la date restent nécessaires avant publication. Les fichiers joints Sanity sont accessibles par leur lien dès leur téléversement. Les modèles OCR sont reconstruits depuis les dépendances avant le démarrage et le build du Studio ; ils ne sont pas chargés sur le site public. Voir le [guide de prise en main](docs/GUIDE-SARA.md).

## Résultat de la recette locale

Après refonte : 37 scénarios Playwright couverts, corrections et relances ciblées réussies dans Chromium et Firefox ; build web, TypeScript et lint réussis. Lighthouse mobile : performance 94/100, LCP 2,7 s, CLS 0. Le déroulement du logo dispose de contrôles visuels dédiés dans Chromium et Firefox, sur ordinateur et mobile. Ces mesures de laboratoire ne remplacent pas la recette connectée ou les mesures de terrain.

Après préparation Sanity/PDF : 38 scénarios publics et 29 tests locaux réussis, builds web/Studio réussis. Six cas d’extraction/OCR et quatre contrôles d’interface avec API Sanity simulée passent. Les mesures Lighthouse ci-dessus précèdent cette préparation ; seuls les budgets de ressources ont été remesurés. Le compte Sanity réel reste à connecter.

Le [compte rendu de recette](docs/RECETTE.md) contient les captures ordinateur/mobile, la vidéo du logo, le protocole Lighthouse et les limites exactes. L’édition privée est compilée séparément au démarrage et au build ; aucun asset d’édition n’est chargé par le visiteur public.

Avant les tests, compiler puis installer les navigateurs si nécessaire :

```powershell
pnpm build
pnpm exec playwright install chromium firefox
pnpm test
```

Les ports 4322, 4324 et 4325 sont réservés à la recette et doivent être libres. Ne pas reconstruire pendant un test. Dans un environnement Windows restreint, Firefox peut exiger une exécution autorisée hors du bac à sable. Si la télémétrie Astro tente d’écrire hors du dossier autorisé, définir `$env:ASTRO_TELEMETRY_DISABLED='1'` dans le terminal de travail.
