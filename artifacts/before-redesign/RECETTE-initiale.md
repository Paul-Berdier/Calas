# Recette locale — 25 octobre 2026

## État réel

Version locale complète des routes demandées, frontend Astro SSR et Studio Sanity séparé. Aucun site mis en production, aucun domaine réservé, aucun compte/service payant souscrit. Les contenus sont explicitement sélectionnés par `CONTENT_MODE=demo`. Le formulaire utilise le transport simulé : aucune demande de recette n’a été envoyée à Sara et aucun corps n’a été conservé.

Environnement inspecté : dépôt initial vide, Node 24.19.0, pnpm 11.25.0. Le MCP documentaire officiel Astro a été consulté par JSON-RPC à son URL publiée ; aucun serveur global n’a été ajouté. Sanity n’était pas connecté : documentation et CLI officiels employés. Les skills officiels Sanity et GSAP consultés sont référencés par commit dans les guides CMS et logo. Aucun Figma, Blender, ComfyUI ou générateur d’image n’était nécessaire.

## Contrôles exécutés

| Contrôle | Résultat |
| --- | --- |
| Build frontend Node standalone | Réussi |
| Build Sanity Studio | Réussi |
| Astro/TypeScript strict, web + Studio | 0 erreur, 0 avertissement |
| ESLint | Réussi ; types générés exclus du lint |
| Cohérence des peer dependencies | Aucun conflit |
| Schéma Sanity / TypeGen | Extraction et génération réussies |
| Préparation seed | 17 documents, tous brouillons ; aucun appel réseau |
| Playwright | 35 tests réussis, Chromium et Firefox |
| Pages | 10 routes éditoriales, articles absents en 404, 404 générale |
| Parcours offres → contact | Diagnostic, Équipes, Managers ; objet maintenu au rechargement et dans un nouvel onglet |
| Formulaire | Validation serveur, erreurs associées, succès simulé, transport indisponible, saisie préservée, nouvelle tentative, double clic, coupure réseau, dépassement du délai |
| Protections du formulaire | Origine, jeton signé, honeypot, bornes du flux/champs, limite de débit, idempotence, destinataire de recette unique |
| Sans JavaScript | Contenu et logo visibles, menu natif utilisable, erreurs et succès du formulaire côté serveur |
| Navigation clavier | Lien d’évitement, focus, menu mobile, annonce de l’état et fermeture Échap |
| axe | Aucun problème détecté avec règles WCAG 2/2.1/2.2 A/AA sur accueil, Diagnostic, contact et erreurs du formulaire, dans les deux navigateurs |
| Mise en page | Captures à 360, 390, 768, 1280, 1440 px ; aucun débordement horizontal sur les pages prioritaires ; champs longs sur contact à 360 px |
| Ressources publiques | Aucun script/style d’édition Sanity ni React/Studio chargé par le visiteur |
| Panne CMS | HTTP 503 lisible, sans détails techniques ni retour silencieux au contenu de démonstration |
| Sécurité preview locale | Cookie forgé, modification de signature, expiration, projet/dataset erroné, redirection externe et activation arbitraire refusés |

La suite se lance sur le **build compilé**, avec trois processus isolés : simulation, panne CMS, panne de transport. Ne pas reconstruire `dist` pendant cette recette. Les captures ont été ouvertes et examinées. La première tentative avait réutilisé un ancien serveur dont les chunks étaient remplacés ; les tests ont été corrigés pour refuser un port occupé. Firefox nécessite une exécution autorisée hors du bac à sable de cet environnement Windows. Les 35 réussites correspondent à la relance propre.

Le contrôle de texte à 200 % dans la suite est une simulation CSS à viewport de 640 px ; il ne vaut pas une validation assistive exhaustive ou une certification WCAG. La revue finale sur les équipements et technologies d’assistance de l’équipe reste utile.

## Logo et mouvement

Sept contrôles supplémentaires sur Chromium **et** Firefox : déformation réelle, progression, silhouette finale exacte, mouvement réduit initial, bascule de préférence en cours, absence de rejeu et repli sans JavaScript. Aucun pixel opaque partagé entre les rubans aux 27 poses échantillonnées. La référence, les poses et les deux fonds ont été examinés ; approbation artistique finale encore attendue.

- [Début](../artifacts/logo-start.png), [milieu](../artifacts/logo-middle.png), [fin](../artifacts/logo-end.png).
- [Vidéo de l’enroulement](../artifacts/logo-motion.webm).
- [Rapport deux navigateurs](../artifacts/logo-browser-report.json).
- [Planche clair/sombre](../assets/brand/contrast-board.png).

## Performance mesurée

Lighthouse **13.5.0**, Chrome for Testing **156.0.8078.4**, Windows, build Node local sur `http://127.0.0.1:4330/`, profil mobile et ralentissement simulé par défaut, cache neuf. Mesure unique reproductible du 25/10/2026, en mode recette non indexable.

| Mesure | Résultat |
| --- | --- |
| Performance mobile | **93 / 100** |
| Accessibilité automatique Lighthouse | **100 / 100** |
| Bonnes pratiques Lighthouse | **100 / 100** |
| LCP de laboratoire | **2,4 s** |
| CLS de laboratoire | **0,085** |
| Total Blocking Time | **0 ms** |
| Poids réseau Lighthouse | **237 Kio** |
| JavaScript externe initial gzip (Playwright) | **27 642 octets**, environ 27 Kio |
| Ressources décodées relevées (Playwright) | **237 814 octets** |

Les petits scripts intégrés font partie du HTML. Les budgets de 150 Ko de JS compressé et d’environ 1 Mo par page sont respectés. Le module privé d’édition (environ 852 Kio JS non compressé) est compilé séparément et ne figure dans aucune requête publique. Un problème de collecte CSS par Astro a été corrigé par cette séparation.

Le score SEO de **63** découle de la désindexation volontaire : `noindex`, `X-Robots-Tag` et robots interdisant l’exploration. Le contrôle Lighthouse des autres critères SEO n’a pas échoué. Ne pas lever ce verrou avant publication approuvée.

Ces résultats ne mesurent pas l’INP réel ni les Web Vitals au 75e percentile. L’hébergement final, le réseau, les images futures et les contenus édités nécessiteront une nouvelle mesure. Aucune certification d’accessibilité n’est revendiquée.

Reproduction, après `pnpm build` et démarrage du serveur compilé :

```powershell
$env:CHROME_PATH='C:\Users\Paul\AppData\Local\ms-playwright\chromium-1248\chrome-win64\chrome.exe'
pnpm exec lighthouse http://127.0.0.1:4330/ --chrome-flags='--headless --no-sandbox' --only-categories=performance,accessibility,best-practices,seo --output=json --output=html --output-path=artifacts/lighthouse-mobile --quiet
```

Adapter le chemin de Chrome sur une autre machine. Rapport : [Lighthouse HTML](../artifacts/lighthouse-mobile.report.html), [inventaire des ressources](../artifacts/resource-budget.json).

## Captures prioritaires pour Sara et Agnès

| Page | Ordinateur | Mobile |
| --- | --- | --- |
| Accueil, premier écran | [1440 px](../artifacts/screenshots/accueil-1440-premier-ecran.png) | [390 px](../artifacts/screenshots/accueil-390-premier-ecran.png) |
| Accueil, page entière | [1440 px](../artifacts/screenshots/accueil-1440.png) | [390 px](../artifacts/screenshots/accueil-390.png) |
| Diagnostic, premier écran | [1440 px](../artifacts/screenshots/diagnostic-1440-premier-ecran.png) | [390 px](../artifacts/screenshots/diagnostic-390-premier-ecran.png) |
| Diagnostic, page entière | [1440 px](../artifacts/screenshots/diagnostic-1440.png) | [390 px](../artifacts/screenshots/diagnostic-390.png) |
| Contact | — | [360 px avec champs longs](../artifacts/screenshots/contact-360.png) |

Les autres tailles sont conservées dans `artifacts/screenshots/`. Sur l’accueil mobile à 390 px, les deux actions précèdent le coquillage et sont visibles dans la capture du premier écran de 844 px.

## Vérifications externes non réalisées

Sans projet/jeton Sanity : édition graphique réelle, remplacement d’image, création et publication d’article, preview authentifiée connectée et en iframe, délai observé de cache, rôles effectifs, historique et restauration des contenus/médias. Le code et les tests locaux de frontière de sécurité ne prouvent pas ces opérations.

Sans SMTP autorisé : authentification réelle, réception et classement, réponse, SPF/DKIM/DMARC. La simulation prouve le parcours applicatif, pas la délivrabilité.

Sans hébergement/domaine : HTTPS réel, proxy et origine, cache de plateforme, CORS final et consentement des personnes chargées de publier. Les pages légales restent des bases de travail non publiables sans identité juridique, hébergeur, destinataires, base légale et conservation validés. Voir [la liste de validation](VALIDATION.md).
