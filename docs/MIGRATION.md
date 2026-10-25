# Migration vers le CMS Calas Conseil

## Périmètre et référence

Demande du 25 octobre 2026 : remplacer Sanity par PostgreSQL, Drizzle, Better Auth et une administration React/Tiptap dans Astro. Le design public, les routes, les textes, le contact et l'OCR sont conservés. Pas de publication de production ni de service payant autorisé.

Base vérifiée : `ece27bda5bcb53219d03c1e44a15e8bc7bc39d9c`, dépôt propre, branche `codex/custom-cms-migration`. Node 24.19.0, pnpm 11.25.0. Aucun Project ID configuré dans les deux applications, aucun contenu distant Sanity identifié. Aucun projet Railway nommé Calas n'apparaît dans l'inventaire consulté ; aucune ressource externe modifiée.

## Plan suivi

| Phase | Travail | État / preuves |
| --- | --- | --- |
| A | Audit, routes, contrats, référence des tests | Vérifié : typecheck web/Studio, lint, build, 29 tests locaux et 38 scénarios Playwright réussis ; rapports `artifacts/migration-baseline-*.log` |
| B | PostgreSQL, migrations, révisions, reprise idempotente | Conception validée, implémentation en cours |
| C | Lecture Astro et rendu riche indépendants du CMS précédent | À faire |
| D | Better Auth, rôles, MFA, invitations et sessions | À faire |
| E | Administration, édition structurée, aperçu et historique | Implémentation isolée en cours |
| F | Tiptap, médias S3 privés, PDF/OCR | Implémentation isolée en cours |
| G | Étude des trois enroulements, comparaison et mouvement final | À faire |
| H | Nettoyage, CI, sauvegarde/restauration, recette et PR | À faire |

## Conservation et correspondance

- `SiteContent` reste le contrat de présentation. Les identifiants deviennent `id`/`key`, les documents riches du JSON Tiptap, les médias des références `mediaId` internes.
- Accueil et pages conservent tous leurs champs et compositions ; les personnes, statistiques, catégories et paramètres gardent leurs données métier.
- Un moteur de documents et de révisions immuables partage le cycle éditorial, avec des tables relationnelles par domaine. Les références publiées et de travail sont distinctes. Une restauration ajoute une révision.
- Les médias demeurent dans un bucket privé. Le serveur décide de leur exposition à partir des références publiées ; un PDF requiert une autorisation de téléchargement explicite.
- La prévisualisation réutilise les pages Astro sous session Better Auth autorisée, avec cache privé désactivé.
- L'ancien Studio ne sera retiré qu'après vérification de ses remplacements. Les captures et résultats historiques restent identifiés comme historiques.

## Risques et contrôles

Concurrence des sauvegardes : version attendue et transaction. Fuite de brouillons : session, rôle, MFA, cache et accès média testés séparément. Perte de données : seed non destructif, migrations explicites et restauration isolée. Régression graphique : comparaison avec les captures et tests de référence. Aucun mot de passe, lien d'invitation, jeton ou contenu de message dans les journaux.

## Journal

- Audit initial : architecture et brief relus ; versions inchangées, aucune modification locale préalable à protéger. Vérification Astro initiale : 40 fichiers, zéro erreur/avertissement. Suite de référence terminée : 29 tests locaux et 38 scénarios Chromium/Firefox réussis.
- Services de recette locaux : PostgreSQL 17, MinIO privé et Mailpit démarrés dans Docker, ports liés à 127.0.0.1. Images verrouillées par digest ; secrets générés dans les fichiers ignorés, aucun envoi externe.
