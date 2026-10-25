# Recette de la migration propriétaire — 25 octobre 2026

Ce rapport décrit la migration depuis `ece27bd`. Les résultats de l’ancienne version sont conservés dans [RECETTE-AVANT-MIGRATION.md](RECETTE-AVANT-MIGRATION.md) ; ils ne sont pas présentés comme une validation du nouveau CMS.

## Environnement et méthode

Windows, Node 24.19.0, pnpm 11.25.0, Astro 7.4.2, Better Auth 1.7.12. PostgreSQL 17 et MinIO réels dans Docker, bucket privé, Mailpit local pour les emails. Les tests de données et de restauration utilisent des bases/buckets temporaires isolés. La recette éditoriale utilise des articles clairement nommés « Recette », archivés en fin de scénario ; aucun article fictif signé Sara n’est laissé public.

Une API simulée est employée uniquement dans les tests unitaires de frontière preview et les tests d’interface qui provoquent volontairement une réponse perdue. Les scénarios de connexion, invitation, MFA, édition, téléversement, publication et restauration ci-dessous utilisent les services réels. Aucun email externe, aucun abonnement ni déploiement Railway.

## Résultats fonctionnels vérifiés

| Périmètre | Preuve |
| --- | --- |
| Référence avant migration | TypeScript, lint, build, 29 tests locaux et38 parcours publics réussis |
| Configuration / preview / rendu riche / seed / PDF / journaux | 44 tests locaux réussis, dont cadrage et suppression des secrets dans les journaux |
| Modèles + persistance | 25 contrôles réussis : validations, seed idempotent, conflit409, publié distinct du brouillon, versions immuables, restauration, clés étrangères et droits |
| Validation des médias | 7 tests réussis : type réel, Sharp, variantes, limites, PDF natif/scanné/mixte, multipart et métadonnées |
| Cycle média réel PostgreSQL/S3 | 16 contrôles réussis : propriété, privé, upload idempotent, métadonnées concurrentes, publication, révocation, remplacement et suppression protégée |
| Contact sur plusieurs processus | 6 contrôles réussis : 4 envois concurrents du même jeton donnent une seule livraison ; 8 processus respectent la même limite de 3 ; contenu modifié refusé ; pool limité à une connexion sans blocage |
| Sauvegarde/restauration | 6 contrôles réussis : archive chiffrée, dump cohérent, restauration réelle dans une autre base et un autre bucket, PDF identique, archive altérée et destination occupée refusées |
| PDF/OCR navigateur | 6 cas réussis : texte natif, scan, mixte, OCR forcé, fichier invalide et annulation ; aucune requête externe |
| Reprise d’import, API simulée explicitement | 5 contrôles d’interface : confirmation préalable, clics multiples, réponse perdue/reprise, brouillon et responsive |
| Authentification réelle | 9 groupes de sécurité réussis, plus connexion TOTP réelle et refus d’accès anonyme |
| Durée des sessions | 2 contrôles réels supplémentaires : session expirée refusée, déconnexion effective côté serveur |
| Fraîcheur des sessions | 5 scénarios supplémentaires : ancien accès toujours éditorial, liste protégée après quinze minutes, reconnexion mot de passe/TOTP, timer d’onglet et expiration pendant un appel ; axe à 390/1440 px |
| Parcours éditorial réel | 20 étapes PDF→Tiptap→aperçu→publication→nouveau brouillon→republication→restauration ; ajout/remplacement d’image, refus de suppression utilisée et suppression d’image inutilisée |
| Administration | 53 états contrôlés aux largeurs 360/390/768/1280/1440 ; zéro violation axe A/AA, erreur console ou débordement horizontal |
| Aperçu public dans l’administration | 15 combinaisons : viewport interne ordinateur/tablette/mobile exact, mise à l’échelle sans rognage, zéro violation axe |
| Cadrage réel d’image |Zone asymétrique vérifiée dans Astro par échantillonnage de9 pixels et descripteurs srcset exacts |
| Mouvement final | 48 contrôles du logo et 26 des effets éditoriaux réussis dans Chromium/Firefox ; chargement différé contrôlé à 390/1440 px |

Les groupes de sécurité couvrent invitations à usage unique, email vérifié, mauvais mot de passe/compte inconnu, TOTP, refus d’une ancienne session pré-MFA, secours à usage unique, rôle éditeur, CSRF, inscription publique interdite, révocation de sessions, vrai lien de récupération Mailpit, jeton consommé et suspension du seul compte créé pour la recette.

## Corrections trouvées pendant la recette

- Compatibilité des URLs Better Auth : accepter les chemins d’API sans barre finale et le callback de réinitialisation, tout en conservant les liens publics existants.
- Tiptap : réactiver l’éditeur sans émettre de modification artificielle après publication.
- Conflits de versions : comparaison JSON canonique pour éviter un changement dû au seul ordre des clés PostgreSQL.
- Prévisualisation : conserver le viewport demandé et adapter son échelle à la colonne.
- Rendu riche et navigation de preview : refuser les propriétés héritées et les chemins privés encodés.
- Médias : appliquer le cadrage exact et annoncer dans srcset les dimensions réelles des variantes.
- CI : migration explicite avec `--apply` et chemins de tests vérifiés.
- Contact : réutiliser la connexion transactionnelle pour la limitation de débit, afin de fonctionner avec un pool limité à une connexion.
- Exécution Windows : une relance des tests locaux a été bloquée par les droits de lecture du bac à sable dans esbuild ; la même commande hors de cette restriction réussit ses 44 contrôles, sans modification du code.
- Première CI : image communautaire MinIO indisponible. Remplacement par une construction depuis source officielle verrouillée ; compilation, santé et intégration PostgreSQL/S3 réussies sur Ubuntu dans l’exécution `40183929033`.
- Deuxième CI : axe a mesuré les statistiques pendant une transition translucide de l’iframe. La capture montre l’animation en cours ; le contraste final est 6,43:1. La recette attend maintenant la fin des révélations avant capture et audit, sans désactiver le mouvement ni exclure de règle axe.
- Compte et sécurité : une session de plus de quinze minutes ne peut pas consulter la liste des sessions selon Better Auth. L’interface ignorait ce refus et affichait une liste vide ; elle explique désormais la reconnexion, sans modifier cette protection. Cinq scénarios vérifient les vraies réponses serveur ; seul le passage du timer d’onglet utilise une horloge de navigateur contrôlée.

Ces échecs initiaux sont conservés comme constats de recette ; les scénarios concernés ont été corrigés et relancés. Les résultats du build final et la mesure Lighthouse sont consignés ci-dessous après leur exécution.

## Performance et protocole

Les mesures locales emploient Lighthouse 13.5.0, Chromium 156, viewport mobile et ralentissement simulé par défaut (CPU×4), navigateur neuf, Astro standalone et PostgreSQL local. Le build final passe TypeScript (90 fichiers, zéro erreur/avertissement, 18 indications de dépréciation), ESLint et compilation. L’administration, Tiptap et les moteurs PDF/OCR restent absents du JavaScript public initial.

| Mesure Windows | Performance | Accessibilité | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- |
| Première migration | 78 | 100 | 3,33 s | 359 ms | <0,001 |
| Initialisation différée | 80 | 100 | 2,67 s | 258 ms | 0,032 |
| Reflow supprimé | 85 | 100 | 2,59 s | 2 ms | <0,001 |
| Authentification serveur différée, dernière mesure locale | 46 | 100 | 4,3 s | 1 220 ms | 0,03 |

Ces résultats ne satisfont pas la cible locale de 90 et leur variabilité est conservée, pas remplacée par le meilleur score. Certaines réponses observées par Lighthouse duraient 10–20 s, alors que les lectures PostgreSQL isolées étaient inférieures à une seconde. L’instrumentation temporaire a observé des rendus ultérieurs autour de 20–40 ms ; le poste disposait d’environ 1,2 Go de mémoire libre pendant la recette. Cela ne démontre pas à lui seul la cause de la variation. L’import privé différé et la suppression du reflow sont des corrections vérifiées, sans garantie tirée d’une mesure isolée.

`scripts/performance-check.mjs` reproduit le même profil de laboratoire dans la CI Ubuntu et impose performance ≥90, accessibilité100 et CLS≤0,1. Le système d’exploitation est différent : son score doit être présenté séparément de la comparaison Windows historique. Le résumé `performance-ci-report.json` et le rapport HTML sont conservés avec les artefacts de chaque exécution. Les mesures détaillées intermédiaires sont dans `artifacts/custom-cms/performance.json`. Aucune donnée Web Vitals de terrain n’est revendiquée.

Première CI intégralement verte : [exécution 40185045623, révision 45cec4ed](https://github.com/Paul-Berdier/Calas/actions/runs/40185045623). Performance mobile **96/100**, accessibilité **100/100**, bonnes pratiques **100/100**, LCP **2,57 s**, TBT **0 ms**, CLS **0,00008**. Le LCP reste légèrement au-dessus de la cible idéale de 2,5 s ; les seuils obligatoires de performance et de stabilité passent. [Rapport Lighthouse Linux](../artifacts/lighthouse-custom-cms-ci.report.html) et [données du protocole](../artifacts/custom-cms/performance-ci-report.json).

Cette exécution vérifie également les deux jobs Linux complets : 44 tests CMS locaux, 15 de domaine, 38 d’intégration, 38 parcours publics, les recettes PDF/OCR et authentifiées, 53 états d’administration, 48 contrôles du logo et 26 des animations éditoriales. Aucun défaut axe ni erreur console après attente correcte des transitions. Le conteneur passe ses cinq groupes de contrôle.

## Captures et rapports

- [Administration1440](../artifacts/custom-cms/admin/dashboard-1440.png) et [390](../artifacts/custom-cms/admin/dashboard-390.png), [rapport53 états](../artifacts/custom-cms/admin/report.json).
- [Aperçus](../artifacts/custom-cms/admin/preview-report.json), [sécurité réelle](../artifacts/custom-cms/auth-security-report.json), [parcours éditorial réel](../artifacts/custom-cms/editorial-e2e/report.json).
- [Étude des trois enroulements](../artifacts/logo-coil/comparison.png), [comparaison animée](../artifacts/logo-coil/comparison.webm), [vidéo sur l’accueil](../artifacts/logo-coil/live.webm).
- Captures publiques ordinateur/mobile : `artifacts/screenshots/`. Les sources graphiques initiales restent versionnées.

Le guide de Sara utilise les captures réelles de la nouvelle administration. Les rapports excluent les mots de passe, secrets TOTP, codes de secours, cookies et liens d’invitation.

## Reproduire

Après installation et services locaux décrits dans le README :

```powershell
pnpm typecheck
pnpm lint
pnpm test:cms-local
pnpm test:domain
$env:RUN_CONTACT_INTEGRATION='1'
$env:CALAS_MEDIA_INTEGRATION='yes'
$env:RUN_BACKUP_INTEGRATION='1'
pnpm test:integration
pnpm build
pnpm exec playwright install chromium firefox
pnpm test
```

La recette authentifiée requiert le compte local privé créé par la procédure de bootstrap, puis `scripts/auth-browser-check.mjs` pour la session MFA. `scripts/acceptance-standalone.mjs` refuse un port 4336 occupé et lance le build en base de données, la connexion, les tests de sécurité et le parcours PDF. La CI prépare sa propre identité aléatoire via `scripts/ci-auth-prepare.mjs` ; cette commande refuse hors CI. Aucun secret de test n’est committé.

## Limites et décisions de production

La recette couvre PostgreSQL, S3 compatible et SMTP local. Elle ne démontre pas une intégration Railway ou une délivrabilité externe. Restent l’autorisation/budget d’hébergement, le domaine détenu par Calas Conseil, les accès réels du cabinet, le fournisseur SMTP et son test autorisé SPF/DKIM/DMARC, la conservation des données, les sauvegardes externes et la validation éditoriale/juridique.

Un remplacement de média conserve son identité et affecte ses utilisations, y compris les anciennes révisions ; l’interface le signale. L’historique restaure le contenu et ses références, pas automatiquement les octets antérieurs du fichier. Les anciennes clés sont conservées dans la sauvegarde. Pour conserver deux visuels indépendants, téléverser un nouveau média.

SMTP ne fournit pas de transaction atomique avec PostgreSQL : une perte de confirmation après envoi peut produire un doublon lors d’une nouvelle tentative. Le formulaire conserve la saisie et n’annonce pas une livraison non confirmée. Les mots de passe et clés perdus simultanément avec les moyens de secours nécessitent une récupération d’exploitation contrôlée, sans contournement public.
