# Migration vers le CMS Calas Conseil

## Périmètre et référence

Demande initiale du 25 octobre 2026 : remplacer Sanity par PostgreSQL, Drizzle, Better Auth et une administration React/Tiptap dans Astro. Le design public, les routes, les textes, le contact et l'OCR sont conservés. Le déploiement était initialement exclu ; Paul a ensuite explicitement autorisé une préproduction Railway avec PostgreSQL et stockage privé, sans publication de production.

Base vérifiée : `ece27bda5bcb53219d03c1e44a15e8bc7bc39d9c`, dépôt propre, branche `codex/custom-cms-migration`. Node 24.19.0, pnpm 11.25.0. Aucun Project ID configuré dans les deux applications, aucun contenu distant Sanity identifié. À l’audit initial, aucun projet Railway nommé Calas n’apparaissait et aucune ressource externe n’avait été modifiée. Le projet créé ensuite par Paul a été identifié avant le déploiement de recette ci-dessous.

## Plan suivi

| Phase | Travail | État / preuves |
| --- | --- | --- |
| A | Audit, routes, contrats, référence des tests | Vérifié : typecheck web/Studio, lint, build, 29 tests locaux et 38 scénarios Playwright réussis ; rapports `artifacts/migration-baseline-*.log` |
| B | PostgreSQL, migrations, révisions, reprise idempotente | Migrations Drizzle appliquées sur PostgreSQL 17 local ; 17 ressources reprises, 25 contrôles modèles/persistance réussis |
| C | Lecture Astro et rendu riche indépendants du CMS précédent | Vérifié : contrat public conservé, preview privée, rendu filtré, 38 parcours publics réussis |
| D | Better Auth, rôles, MFA, invitations et sessions | Vérifié en services réels : 9 groupes sécurité, connexion TOTP, expiration et déconnexion |
| E | Administration, édition structurée, aperçu et historique | Vérifié : 53 états responsive et 15 aperçus, zéro défaut axe/console/débordement |
| F | Tiptap, médias S3 privés, PDF/OCR | Vérifié : 20 étapes réelles, 6 cas OCR, médiathèque privée, remplacement et suppression protégée |
| G | Étude des trois enroulements, comparaison et mouvement final | 48 contrôles logo, 26 contrôles éditoriaux et 1 515 états géométriques réussis ; initialisation différée et coût géométrique réduit, contours finaux exacts |
| H | Nettoyage, CI, sauvegarde/restauration, recette et PR | Terminé : sauvegarde/restauration vérifiée, Sanity retiré, CI complète verte sur 48ade34a, mobile 96/100, conteneur vérifié ; PR 1 ouverte en brouillon pour relecture |

## Conservation et correspondance

- `SiteContent` reste le contrat de présentation. Les identifiants deviennent `id`/`key`, les documents riches du JSON Tiptap, les médias des références `mediaId` internes.
- Accueil et pages conservent tous leurs champs et compositions ; les personnes, statistiques, catégories et paramètres gardent leurs données métier.
- Un moteur de documents et de révisions immuables partage le cycle éditorial, avec des tables relationnelles par domaine. Les références publiées et de travail sont distinctes. Une restauration ajoute une révision.
- Les médias demeurent dans un bucket privé. Le serveur décide de leur exposition à partir des références publiées ; un PDF requiert une autorisation de téléchargement explicite.
- La prévisualisation réutilise les pages Astro sous session Better Auth autorisée, avec cache privé désactivé.
- L’ancien Studio a été retiré après vérification de ses remplacements. Les captures et résultats historiques restent identifiés comme historiques.

## Risques et contrôles

Concurrence des sauvegardes : version attendue et transaction. Fuite de brouillons : session, rôle, MFA, cache et accès média testés séparément. Perte de données : seed non destructif, migrations explicites et restauration isolée. Régression graphique : comparaison avec les captures et tests de référence. Aucun mot de passe, lien d'invitation, jeton ou contenu de message dans les journaux.

## Journal

- Audit initial : architecture et brief relus ; versions inchangées, aucune modification locale préalable à protéger. Vérification Astro initiale : 40 fichiers, zéro erreur/avertissement. Suite de référence terminée : 29 tests locaux et 38 scénarios Chromium/Firefox réussis.
- Services de recette locaux : PostgreSQL 17, MinIO privé et Mailpit démarrés dans Docker, ports liés à 127.0.0.1. Images verrouillées par digest ; secrets générés dans les fichiers ignorés, aucun envoi externe.
- Phase B : moteur `content_documents`/`content_revisions` partagé, tables métier et sous-tables de révisions des pages/articles. JSONB strictement validé, clés étrangères, garde SQL d’immutabilité et propriété des pointeurs, concurrence optimiste et transactions. Le seed a repris neuf pages, l’accueil, deux personnes, quatre statistiques et les paramètres ; aucun article inventé. Nouvelle lecture publique depuis PostgreSQL, sans cache applicatif partagé.
- Tests B : 25 contrôles réussis sur modèles et base isolée, dont seed idempotent, brouillon distinct du publié, publication, restauration, refus d’écrasement concurrent, refus de révision étrangère, rôles, références, médias PDF privés, autorisation de téléchargement et dépublication. Une erreur de comparaison liée à l’ordre des clés JSONB a été détectée puis corrigée avec une sérialisation canonique.
- Phase H, sauvegarde : six contrôles réussis, dont dump PostgreSQL et restauration sur deux bases et deux buckets S3 locaux isolés, avec historique, comptes, brouillon plus récent et octets PDF conservés. Archive AES-256-GCM, inventaire SHA-256 et contrôles avant écriture. Aucune restauration distante revendiquée. Procédure et limites dans `docs/BACKUP.md`.

- Phases C–F : tests de données, de services et de navigateurs réellement exécutés. Correction du routage Better Auth, de l’état Tiptap après publication, du cadrage d’image et de l’aperçu mobile. Les anciennes suites CMS ont été remplacées, pas supprimées sans équivalent.
- Phase G : trois variantes comparées ; B retenue, enroulement extérieur vers noyau en 2,2 s, tracé final exact. Firefox a révélé un flash initial, corrigé puis contrôlé dans les deux moteurs. Initialisation différée, ScrollTrigger absent du premier écran d’accueil, reflow supprimé et calcul géométrique réduit d’environ80% dans le microbenchmark. Les mesures Windows78/80/85/46 sont toutes conservées ; un contrôle Lighthouse mobile ≥90 est désormais exécuté sur Ubuntu en CI, séparément de cette série locale variable.
- Exploitation : journalisation filtrée pour retirer secrets et URLs de récupération ; tests dédiés réussis. Contact SQL vérifié sur plusieurs processus et avec un pool limité à une connexion.
- Commits logiques : données et sauvegardes `8223de3`, administration et sécurité `31625cd`, médias/PDF `24b8c8c`, raccordement Astro/retrait Sanity `71dcb69`, logo `183f3ce`.
- CI : l’image MinIO historique n’était plus récupérable ; une construction depuis source officielle vérifiée remplace cette dépendance de recette. Sur Ubuntu, migrations, S3, sauvegarde/restauration,44 tests CMS locaux,15 de domaine,38 d’intégration,38 publics, OCR, authentification et parcours PDF réussissent. Le dernier défaut de contraste concernait un instant de transition dans l’iframe ; l’audit attend maintenant la stabilité sans désactiver l’animation.
- Pull request de migration : https://github.com/Paul-Berdier/Calas/pull/1, branche `codex/custom-cms-migration`, sans fusion ni déploiement.
- Livraison vérifiée : [CI 40186258008](https://github.com/Paul-Berdier/Calas/actions/runs/40186258008), branche `48ade34a` et fusion synthétique GitHub `37d040ec`. Deux jobs réussis ; cinq scénarios de fraîcheur de session ajoutés et réussis. Performance mobile Linux 96, accessibilité 100, TBT 0, CLS 0,00008. Les rapports Windows variables restent disponibles et ne sont pas présentés comme une mesure comparable du runner Linux.
- Le site local reste accessible sur `http://localhost:4321/` et `/admin/`, avec `CONTENT_MODE=database`. Les serveurs temporaires 4336/4338 ont été arrêtés. Restent uniquement les raccordements externes et les validations de production décrits dans `VALIDATION.md` ; aucun déploiement public n’a été effectué.
- Autorisation ultérieure de Paul : déploiement de test dans son nouveau projet Railway **Calas**, administration complète, PostgreSQL et stockage privé, puis compte de recette sans email externe. Le 25 octobre, le déploiement `bc1098b0-5644-48a6-bcfd-a3a0eb7fed71` a réussi sur `https://calas-web-test-production.up.railway.app/`, commit `3de2cd5`. PostgreSQL 17.11 et bucket privé à Amsterdam ; `SITE_ENV=staging`, contact simulé et désindexation. Migrations et seed17 exécutés explicitement par tunnel SSH, rôle applicatif limité ajouté et testé. Compte de recette neuf avec activation privée et TOTP à activer par Paul. Détails, preuves et limites dans `DEPLOYMENT.md` et `artifacts/railway-review/`. Aucune validation de production ni délivrabilité externe revendiquée.
- Recette HTTPS : refus d’origine à la connexion détecté puis corrigé dans `0c4e0b97`, sans réduire les gardes CSRF. Le déploiement final `757213ce-9369-4bcb-abf4-8ef80d20cb3e` est réussi ; **45 contrôles publics et 8 groupes administratifs passent**, incluant nouvelle connexion TOTP, édition et cycle privé des images/PDF S3. Comptes techniques suspendus et sessions révoquées, médias de test supprimés, compte de Paul intact. Trois tests de régression HTTPS et deux tests du rôle PostgreSQL passent, ajoutés à la CI. Les échecs initiaux restent documentés.
- Validation finale Railway : [CI 40201737133](https://github.com/Paul-Berdier/Calas/actions/runs/40201737133) entièrement verte sur `0c4e0b97` (`validate`, `container`). Tunnel SSH opérateur fermé après recette. Aucun secret connu détecté dans les fichiers livrés. Le commit documentaire suivant conserve les preuves sans modifier la version applicative déployée.
- Ajustement demandé ensuite par Paul : connexion identifiant/mot de passe pour son seul compte de recette. Commit `cbe33b8`, exception strictement `staging` avec ID opérateur exact et adresse réservée, gardes email/session/rôle/origine inchangées. Production et autres comptes conservent la MFA. Aucun résultat MFA forgé. Quatre groupes de tests de permissions et routes passent, typecheck/lint réussissent et une revue de sécurité indépendante ne relève pas de point bloquant.
- Déploiement de cet ajustement `cae77967-94b7-421c-a16b-2e4a5bde37fe` réussi. Un enrollment en attente et une ancienne session du compte ciblé ont été retirés ; anciens codes invalidés, mot de passe et email vérifié conservés. Six groupes de recette distante passent, dont vraie connexion sans MFA, Réflexions et formulaire d’article sans QR, refus anonymes/CSRF/routes MFA, aucune mutation de contenu et déconnexion de la seule session de test. Le fichier d’accès privé contient maintenant les instructions simples. Rapports `password-only-*` dans `artifacts/railway-review/`.

## Corrections éditoriales du 26 octobre 2026

Le PDF de corrections fourni par Paul remplace cinq champs de l’accueil : `intro`, `diagnostic.text` et les trois `reasons[].text`. Ces textes sont repris dans le contenu de recette initial. Aucun titre, statistique, bouton, coordonnée ou contenu d’article n’est remplacé. La mention IPRP provient du texte fourni ; le statut de qualification demeure `pending`, sans justificatif ni numéro ajoutés.

Une base déjà initialisée ne relit pas automatiquement `demo.ts`. La commande datée suivante prépare donc une révision ciblée, sans réimporter le site :

```powershell
pnpm --filter @calas/web exec tsx ../../scripts/content-correct-home-20261026.ts --dry-run
# Après examen du rapport, avec l’ID d’un administrateur local actif et vérifié :
pnpm --filter @calas/web exec tsx ../../scripts/content-correct-home-20261026.ts --apply --actor-id=ID_ADMIN_LOCAL
# Ajouter --publish-local uniquement pour rendre cette correction visible en recette locale.
```

Le mode par défaut est une simulation en lecture seule. La commande refuse production, staging, adresses distantes, autres bases et autres ports : seul `calas_development` sur le port local 15432 est accepté avec le site local 4321. Elle compare chaque texte à sa valeur précédente ou à la correction datée, conserve les autres champs, crée une révision via le moteur CMS et respecte la version attendue. `--publish-local` refuse tout autre changement inédit entre brouillon et publication. Réexécuter une correction déjà appliquée ne crée pas de nouvelle révision. Aucun script de démarrage, d’installation ou de compilation n’appelle cette commande ; aucune opération distante n’est incluse.

Les quatre tests `tests/home-correction.test.ts` vérifient la portée locale, les champs préservés, le refus de textes édités depuis et l’idempotence. Une exécution de ces tests ne vaut pas application de la correction en base.

Application locale effectuée le 26 octobre : la simulation a trouvé cinq corrections sur l’accueil en version 1, sans autre brouillon inédit. Après revue du script, l’opération explicite avec un administrateur local actif et vérifié a créé la révision corrigée puis sa publication de recette. La nouvelle simulation constate la version 3 et zéro correction restante. L’historique est conservé. Le site Railway et sa base n’ont pas été modifiés par cette opération.

Le lettrage a été recomposé d’après la carte fournie : capitales fines, deux grands C, espacement resserré et signature en capitales. Les mêmes tracés vectoriels servent au site, à la connexion, à l’administration et aux exports. Il s’agit d’une reproduction typographique de la référence raster, sans identification certaine de sa fonte originale. Le coquillage et son animation conservent leur source et leurs contours. L’introduction respecte les deux paragraphes du PDF ; le logo reste contenu au zoom texte de 200 %.

Vérification locale du 26 octobre : typecheck sans erreur ni avertissement (18 indications de dépréciation préexistantes), lint et build réussis ; quatre tests de correction ciblée, cinq scénarios publics (responsive, zoom, absence de JavaScript, accessibilité et ressources) réussis. Les 48 contrôles du logo passent sous Chromium et Firefox, dont mouvement réduit et absence de JavaScript. Firefox a nécessité une exécution hors sandbox après un arrêt du navigateur dans celle-ci. La page de connexion passe le contrôle de largeur et axe à cinq tailles. Les rapports et captures de cette correction sont dans `artifacts/corrections-20261026/`. Le serveur local 4321 reste disponible en mode base de données ; les serveurs standalone de tests ont été arrêtés après leur recette. Ces vérifications ne constituent pas une validation éditoriale de production.
