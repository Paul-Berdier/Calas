# Archive de recette antérieure à la migration

Ce document conserve les observations de la version Sanity. Il ne décrit pas le fonctionnement actuel ; lire RECETTE.md pour la livraison propriétaire.

# Recette après refonte — 25 octobre 2026

## Version livrée

Refonte locale de l’accueil, du Diagnostic, des pages Équipes/Managers/Approche/Équipe, de Réflexions et du contact. Composition, navigation, typographie et mouvement sont revus. Le titre et les six blocs de l’accueil sont conservés. Les compléments éditoriaux reposent sur les pièces fournies et restent à relire par Calas Conseil.

Le site tourne avec Astro SSR, un Studio Sanity séparé et le mode explicite `CONTENT_MODE=demo`. Aucun déploiement, achat ou envoi réel à Sara. Aucun portrait, article signé, témoignage, qualification ou engagement commercial inventé.

## Vérifications exécutées

| Contrôle | Résultat |
| --- | --- |
| Build frontend Node standalone | Réussi sur la version finale |
| Astro/TypeScript web | 35 fichiers, zéro erreur/avertissement |
| TypeScript Studio | Réussi ; schémas inchangés par la refonte |
| ESLint web et Studio | Réussi |
| Suite Playwright | 37 scénarios couverts sur Chromium et Firefox ; détail des relances ci-dessous |
| Navigation | Routes, liens internes, un H1, 404, objets des offres conservés au contact |
| Formulaire | Erreurs serveur, simulation, panne de transport, nouvelle tentative, double clic, coupure réseau et délai dépassé |
| Sans JavaScript | Menu, contenus, formulaire, étapes du Diagnostic et FAQ utilisables |
| Clavier | Lien d’évitement, menu/Échap, ouverture des étapes du Diagnostic |
| Responsive | Accueil et Diagnostic à 360/390/768/1280/1440 px, pages secondaires à 360/768 px, Contact/Réflexions de 320 à 1440 px ; aucun débordement observé |
| Accessibilité automatique | axe WCAG A/AA sur accueil, Diagnostic et contact à 1280 et 390 px dans Chromium et Firefox, puis erreurs de formulaire : aucune violation |
| Motion | 13 contrôles par navigateur, Chromium et Firefox, sans erreur JS |
| Public/CMS | Budgets respectés ; aucun script d’édition Sanity, React ou Studio chargé publiquement |
| Frontières serveur | Tests locaux de session preview signée, origine/antispam, flux bornés et idempotence conservés et réussis |

La première exécution de la suite a validé 35 scénarios sur 37. Les deux audits axe ont relevé le contraste des numéros de section ; une relance a également révélé l’opacité transitoire du bouton d’accueil. Les repères sont désormais opaques et les actions du héros ne sont plus estompées. Lighthouse mobile a ensuite détecté un lien fléché sans nom accessible : son libellé a été ajouté et les audits axe ont été étendus au mobile. La relance finale des cinq scénarios concernés (deux audits axe, captures responsive, contact étroit/texte agrandi, budgets) réussit intégralement. Les scénarios indépendants déjà réussis n’ont pas été rejoués inutilement.

Le test de texte agrandi à 200 % est une simulation CSS à 640 px. Les outils automatiques ne constituent pas une certification d’accessibilité.

## Mouvement

La coquille apparaît désormais en se déroulant depuis son noyau, ruban par ruban, sur 2,34 secondes. La pointe se courbe localement pendant sa progression ; le corps déjà formé et le conteneur restent fixes. Les cinq tracés finaux sont exactement ceux de la source SVG. Le logo est exclu de la parallaxe ; les autres décors conservent un déplacement limité à 18 px sur ordinateur.

Après cette correction, le build, le contrôle de types et le lint réussissent. La recette dédiée valide sept contrôles dans chacune des quatre combinaisons Chromium/Firefox et 1440/390 px : petite surface initiale, croissance visible, conteneur stable, tracés finaux exacts, état DOM avant peinture, mouvement réduit et absence d’erreur JavaScript. La planche des six étapes a été inspectée. L’échantillonnage DOM par frame complète la vidéo ; il ne constitue pas une analyse pixel par pixel de toutes les peintures.

Les 13 contrôles généraux de mouvement ont également été rejoués et réussissent dans chacun des deux navigateurs sur le build standalone. Un contrôle indépendant sur le serveur de développement confirme le logo complet sans JavaScript, avec mouvement réduit au chargement, après blocage des scripts externes et après changement de préférence pendant le déroulement. Le test ciblé des budgets publics réussit avec 49 059 octets de JavaScript gzip et 283 245 octets de ressources décodées.

- [Déroulement corrigé en vidéo](../artifacts/logo-unfurl.webm).
- [Six étapes du déroulement](../artifacts/logo-unfurl/progression.png) et [rapport dédié](../artifacts/logo-unfurl/report.json).
- [Rapport animation Chromium/Firefox](../artifacts/logo-browser-report.json).
- [Méthode animée](../artifacts/logo-method-progress.png).
- [Sources, provenance et détails](LOGO.md).

## Performance mobile

Lighthouse 13.5.0, Chrome for Testing 156.0.8078.4, Windows, build standalone sur `http://127.0.0.1:4330/`, profil mobile et ralentissement simulé par défaut, cache neuf. Mesure de la refonte après préchargement des polices locales et corrections d’accessibilité, avant la correction du déroulement du logo. Lighthouse n’a pas été rejoué après cette correction ; seuls les budgets publics ont été remesurés ci-dessus.

| Mesure | Résultat |
| --- | --- |
| Performance mobile | **94/100** |
| Accessibilité Lighthouse | **100/100** |
| Bonnes pratiques | **100/100** |
| LCP de laboratoire | **2,7 s** |
| CLS | **0** |
| Total Blocking Time | **10 ms** |
| Poids Lighthouse | **274 Kio** |
| JavaScript externe initial gzip | **46 249 octets** |
| Ressources décodées Playwright | **276 131 octets** |

Le score mobile dépasse la cible de 90 ; le LCP de laboratoire reste légèrement au-dessus de l’objectif de 2,5 s et devra être remesuré sur l’hébergement retenu. Aucun INP réel ni résultat au 75e percentile n’est revendiqué. Les budgets de 150 Ko de JavaScript compressé et d’environ 1 Mo de ressources restent respectés. Le score SEO de 63 correspond à la désindexation volontaire de la recette ; ne pas la lever avant publication approuvée.

[Rapport Lighthouse HTML](../artifacts/lighthouse-redesign-mobile.report.html) · [Inventaire des ressources](../artifacts/resource-budget.json).

Reproduction après `pnpm build`, dans un terminal dédié :

```powershell
$env:HOST='127.0.0.1'
$env:PORT='4330'
node --env-file-if-exists=.env dist/server/entry.mjs
```

Le serveur ci-dessus se lance depuis `apps/web`. Dans un second terminal à la racine, adapter le chemin de Chrome à la machine :

```powershell
$env:CHROME_PATH='C:/Users/Paul/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
pnpm exec lighthouse http://127.0.0.1:4330/ --output html --output json --output-path ./artifacts/lighthouse-redesign-mobile --chrome-flags='--headless' --no-enable-error-reporting --quiet
```

Ne pas reconstruire `dist` pendant qu’un serveur de recette l’utilise. Le serveur de développement `pnpm dev` reste indépendant.

## Captures de revue

| Page | Ordinateur | Mobile |
| --- | --- | --- |
| Accueil, premier écran | [1440 px](../artifacts/screenshots/accueil-1440-premier-ecran.png) | [390 px](../artifacts/screenshots/accueil-390-premier-ecran.png) |
| Accueil, entière | [1440 px](../artifacts/screenshots/accueil-1440.png) | [390 px](../artifacts/screenshots/accueil-390.png) |
| Diagnostic, premier écran | [1440 px](../artifacts/screenshots/diagnostic-1440-premier-ecran.png) | [390 px](../artifacts/screenshots/diagnostic-390-premier-ecran.png) |
| Diagnostic, entière | [1440 px](../artifacts/screenshots/diagnostic-1440.png) | [390 px](../artifacts/screenshots/diagnostic-390.png) |
| Contact | [1440 px](../artifacts/screenshots/contact-refonte-1440.png) | [360 px](../artifacts/screenshots/contact-refonte-360.png) |
| Réflexions | [1440 px](../artifacts/screenshots/reflexions-refonte-1440.png) | [360 px](../artifacts/screenshots/reflexions-refonte-360.png) |

Les captures ont été ouvertes et inspectées. Les deux actions de l’accueil à 390 px sont visibles avant le coquillage. La version précédente est conservée dans `artifacts/before-redesign` et les anciens états de mouvement dans `artifacts/logo-original`.

## Préparation Sanity et import PDF — complément du 25 octobre

Les champs de textes, images, annotations et présentations de section ont été raccordés au Studio après la refonte. Le seed prépare 17 documents structurés en brouillon. Les configurations locales sont alignées, une clé de session est générée et le diagnostic de configuration ne montre pas les secrets. Le Project ID et les jetons restent absents : le site reste en démonstration explicite.

L’import PDF crée un article modifiable avec le fichier original joint. L’extraction et l’OCR français/anglais se déroulent localement dans le navigateur ; une analyse complète forcée est proposée pour les pages hybrides. Les essais ne comportent ni données du cabinet, ni véritable connexion Sanity.

| Vérification après raccordement | Résultat |
| --- | --- |
| Typecheck web / Studio | 40 fichiers Astro, aucune erreur/avertissement ; Studio réussi |
| Lint et builds web / Studio | Réussis ; assets OCR séparés dans le Studio |
| Suite publique Playwright | **38 scénarios réussis** sur Chromium/Firefox |
| Contrôles locaux CMS/PDF | **29 tests réussis** : configuration, sécurité preview, images, téléchargements, seed, brouillons et formatage |
| PDF réel dans Chromium | Texte natif, scan, document mixte, OCR forcé, PDF invalide et annulation pendant chargement des modèles : **6 cas réussis**, zéro requête externe observée |
| Composant Studio, API simulée | **4 contrôles réussis** : aucun upload avant action, double clic, réponse perdue puis reprise idempotente, ouverture du brouillon |
| Budget public remesuré | 49 059 octets JS gzip ; 283 257 octets de ressources décodées ; aucun moteur OCR chargé publiquement |

Le test d’annulation pendant le chargement OCR a révélé une attente de terminaison PDF.js non résolue. Le nettoyage est désormais unique, ordonné et borné ; la reproduction complète réussit après correction. Les captures de l’extraction et de l’interface ont été ouvertes et inspectées. Les accès Sanity simulés sont explicitement indiqués sur ces captures.

[Rapport PDF/OCR](../artifacts/pdf-import/report.json) · [Rapport interface](../artifacts/pdf-import/studio-report.json) · [Aperçu de l’importeur en test local](../artifacts/pdf-import/studio-analysis-ready.png).

Lighthouse n’a pas été rejoué pour ce raccordement. Les scores précédents ne sont pas présentés comme une nouvelle mesure. L’upload réel, l’édition des textes/images, l’activation de la preview, la publication et le cache doivent toujours être recettés avec le compte du cabinet, puis un PDF représentatif.

## Limites de la connexion réelle

Le CMS n’est pas connecté à un projet Sanity réel : édition, publication, remplacement d’image, preview authentifiée en iframe, délai de cache, rôles et restauration restent à vérifier avec les accès du cabinet. L’administration et ses schémas existent ; les tests locaux ne remplacent pas cette recette connectée.

Le formulaire fonctionne en simulation. SMTP, SPF/DKIM/DMARC et réception réelle restent à configurer et tester sur une destination autorisée. Aucun courriel de recette n’est envoyé à Sara.

Les portraits, articles, biographie complète d’Agnès, qualification IPRP et paramètres commerciaux manquants restent dans la liste de validation. Les pages légales nécessitent l’identité juridique, l’hébergeur et les règles réelles de traitement. Les compléments de texte de cette refonte, puis l’accueil et le Diagnostic, doivent être relus avant publication. Voir [VALIDATION.md](VALIDATION.md).
