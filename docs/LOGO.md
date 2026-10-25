# Identité et mouvement de Calas Conseil

## Source unique

Le nom public est **Calas Conseil**, avec un seul « s ». La référence JPEG n’est jamais servie par le site. Les lettres sont recomposées en Cormorant Garamond ; la signature utilise EB Garamond.

Le symbole vient de la silhouette de la coquille fournie. Ses cinq rubans pleins ont été extraits du contraste de couleur, puis redessinés en courbes de Bézier cubiques pour supprimer les irrégularités du JPEG. `assets/brand/geometry.mjs` est la source géométrique éditable qui construit toutes les variantes ; `contours.json` conserve l’étude de tracé initiale. Les vides sont réellement transparents. La gradation reproduit une dorure sobre avec les couleurs du brief ; ce n’est pas une reproduction pixel à pixel des reflets du JPEG.

Les contours finaux sont cinq chemins de courbes, sans image matricielle embarquée. Le noyau est situé en `(162,373)` dans le repère source. La reconstruction et la dorure doivent être validées visuellement par Sara et Agnès.

## Fichiers et reproduction

Après installation des dépendances, lancer depuis la racine :

```sh
node scripts/brand-export.mjs
```

Les exports autonomes sont dans `apps/web/public/brand/` : horizontal, empilé, symbole, monochrome bleu, monochrome ivoire, versions pour fond sombre et favicon, chacun en SVG et PNG transparent. Les lettres des SVG autonomes sont vectorisées à partir des polices locales pour ne dépendre d’aucune police installée chez le destinataire.

`assets/brand/logo-editable.svg` conserve les textes éditables. Installer les deux polices OFL livrées dans les dépendances pour le modifier. La commande facultative `node scripts/brand-trace.mjs <reference-jpeg>` reproduit l’étude initiale des contours (cadrage fixe de la référence fournie). Elle n’est pas nécessaire pour exporter ou utiliser la marque ; les cinq chemins finaux restent dans `geometry.mjs`.

Le favicon garde la silhouette simplifiée en monochrome, sans dorure ni typographie. Les PNG sont exportés à 2× la taille nominale, sauf le favicon limité à 64 × 64 px.

## Animation signature

Le coquillage **apparaît en se déroulant depuis son noyau**, puis reste immobile. Un petit brin naît au centre ; les cinq rubans avancent le long de leurs propres courbes vers l’extérieur, dans l’ordre `[3, 0, 1, 2, 4]`. Une timeline GSAP coordonne ce déroulement sur **2,34 secondes**. Les rubans extérieurs sont absents au début. Le nom, la navigation et le conteneur du logo restent fixes ; aucune parallaxe n’est appliquée au logo.

`assets/brand/unfurl.mjs` contient les axes de progression, les temps de départ et la géométrie temporaire. Chaque ruban utilise un masque SVG progressif, accompagné d’une courbure localisée près de sa pointe. La déformation atteint au maximum 7 unités du repère SVG et s’annule derrière cette zone : le corps déjà déroulé demeure en place. Le guide et le contour reçoivent la même déformation. À la fin de chaque ruban, le chemin original de `geometry.mjs` est rétabli exactement et le masque retiré. Les projections géométriques sont préparées une seule fois, à la première utilisation du ruban ; les pages sans logo animé n’effectuent pas ces calculs.

Le HTML de `Shell.astro` contient toujours le logo final statique. Pour la seule variante animée, un court script inline place le symbole en attente avant sa première peinture, uniquement lorsque le mouvement est autorisé. Si le module d’animation ne prend pas la main, un garde-fou réaffiche la silhouette finale après **1 400 ms** et empêche un démarrage tardif. Sans JavaScript ou avec mouvement réduit, le logo final est directement visible. Les textes et appels au contact ne passent jamais par cet état d’attente.

Le déroulement utilise GSAP Core, sans plugin de morphing ni React, et se joue une seule fois à l’apparition du grand symbole. `gsap.matchMedia()` respecte `prefers-reduced-motion`, y compris son changement pendant la session : observers, timeline et masques sont supprimés, puis les tracés finaux rétablis. `initMotion()` retourne une fonction de nettoyage. Une erreur d’initialisation ou de rendu restaure également la silhouette finale.

Les poses `motion-start`, `motion-middle` et `motion-end` dans `assets/brand/` sont exportées avec `unfurlSvg()` à **0,20 s, 1,15 s et 2,34 s**. Elles utilisent des longueurs de masque absolues pour le rendu raster de l’étude ; le navigateur utilise son support natif de `pathLength`. `contrast-board.png` présente la silhouette finale sur les deux fonds. La précédente étude radiale et ses captures sont historiques ; elles ne représentent plus le mouvement livré.

Le visuel Open Graph `public/brand/open-graph.png` mesure 1200 × 630 px ; ses textes sont vectorisés avant rasterisation. Les licences des deux familles typographiques sont copiées dans `assets/brand/licenses/`.

`node scripts/brand-verify.mjs` vérifie désormais les cinq contours finaux exacts, les coordonnées finies de **70 états de ruban** et la croissance de la surface visible à **22 instants**. Exécution réussie : 0 pixel au départ, 2 099 pixels à 0,05 s, 57 691 pixels à 1,15 s et 126 158 pixels à la fin dans le protocole raster de l’étude. Le contrôle des 27 intersections de l’ancienne déformation radiale n’est pas une validation du nouveau déroulement et n’est plus revendiqué pour celui-ci.

La couverture des guides a aussi été mesurée dans Chromium : 99,69 % à 100 % de la surface de chaque ruban avant retrait du masque. Le petit résidu se situe principalement dans le noyau ; le retour au chemin source final restitue l’intégralité du symbole. Six poses du ruban 0 ont été contrôlées après ajustement du guide : une seule composante visible à chaque pose, sans poussière détachée. Ces mesures complètent la revue visuelle ; elles ne constituent pas une garantie géométrique sur tous les instants possibles.

## Composition et mouvement éditorial

`LinkArt.astro` est un décor SVG distinct de la coquille et de la marque. La variante `converge` représente des trajectoires qui rejoignent une direction commune ; `orbit` entrelace des arcs ouverts. Les variantes claire et sombre reprennent les couleurs de la composition. Ce visuel ne contient ni donnée, ni preuve commerciale, ni information indispensable ; il est masqué aux technologies d’assistance. La coquille reste issue de sa source unique, sans être remplacée par ce décor.

`initMotion()` est appelé une seule fois dans le Layout public. Il coordonne désormais aussi les animations éditoriales avec GSAP ScrollTrigger :

- `data-reveal` : apparition de 600 ms avec une translation de 24 px. Les groupes reçoivent un décalage de 80 ms ; sur les écrans où ils s’empilent, leurs lignes se révèlent lors de leur entrée effective dans le viewport.
- `data-line` : dessin de trajectoires SVG en 1,25 s, avec de légers décalages. Le fond de tracé reste visible pendant l’animation. Le calcul de longueur repose sur l’API SVG native.
- `data-parallax` : déplacement des autres décors limité à 18 px, réservé aux grands écrans avec pointeur précis. Le logo en est exclu. Le mouvement suit le défilement naturel, sans boucle permanente. Le point de convergence de LinkArt peut réagir de deux pixels au pointeur.
- `.reading-progress` : progression de lecture en haut de page, liée au défilement.
- `data-method` / `data-step` : progression du diagnostic et accent de l’étape parcourue. Les attributs d’état portent explicitement `"true"` ou `"false"`. L’ouverture d’un accordéon déclenche un recalcul des positions au prochain frame ; les textes et l’état ouvert restent indépendants de ces accents.

Les règles associées se trouvent dans `styles/motion.css`, complétées par les styles propres aux compositions. Aucun contenu n’est masqué par défaut pour attendre le script : les effets commencent seulement à l’entrée dans la zone visible. Le focus clavier termine immédiatement une révélation en cours si nécessaire. Le défilement n’est ni détourné ni bloqué ; aucun élément n’est épinglé par ScrollTrigger.

Avec `prefers-reduced-motion`, y compris après un changement de préférence pendant la visite, les timelines et triggers sont révoqués, les coordonnées finales du logo rétablies et les styles temporaires supprimés. Sans JavaScript, le logo, les tracés et les textes sont présents dans leur forme statique ; les accordéons utilisent les éléments HTML natifs `details` / `summary`. Les listeners de pointeur, de focus et de changement d’accordéon sont nettoyés à la sortie de page.

## Recette actuelle du déroulement

`node scripts/logo-unfurl-check.mjs` vérifie le déroulement réel dans **Chromium et Firefox, à 1440 et 390 px de largeur** : petit brin initial, croissance de la surface visible, conteneur stable, logo final exact, état DOM avant peinture, état final avec mouvement réduit et absence d’erreur JavaScript. L’échantillonnage DOM par frame recherche un symbole entier visible avant initialisation ; il complète la vidéo sans constituer une analyse exhaustive des peintures. Les quatre combinaisons moteur/largeur sont présentes dans `artifacts/logo-unfurl/report.json`.

Les six captures successives et leur planche sont dans `artifacts/logo-unfurl/phase-1.png` à `phase-6.png` et `progression.png`. La vidéo actuelle est **`artifacts/logo-unfurl.webm`**. La forme finale reste celle de la source commune. Les résultats de la recette générale et les tests supplémentaires de repli sont consignés dans le compte rendu principal du projet.

## Recette générale du mouvement

Après la correction du déroulement, `node scripts/brand-browser.mjs` a vérifié **13 contrôles dans Chromium et les mêmes 13 dans Firefox**, à 1440 × 1000 px, sur le build standalone, sans erreur JavaScript. Ce rapport couvre le logo, les effets éditoriaux et leurs replis. La recette dédiée ci-dessus ajoute le contrôle de croissance visible et du conteneur fixe sur ordinateur et mobile. Ces contrôles ciblés sont distincts de la suite Playwright Test générale du projet.

1. Déformation effective des chemins du logo.
2. Progression entre le début et le milieu de la timeline.
3. Retour exact aux chemins vectoriels finaux.
4. Pose statique avec mouvement réduit au chargement.
5. Retour à la pose finale après changement de préférence pendant l’enroulement.
6. Absence de rejeu lors du changement de préférence.
7. Logo complet sans JavaScript.
8. Dessin effectif des trajectoires au défilement.
9. Révélation effective des contenus au défilement.
10. Progression de lecture liée au défilement.
11. Progression du diagnostic conservée après ouverture d’une étape.
12. Nettoyage du mouvement de méthode en mode réduit, sans fermer l’étape choisie.
13. Consultation des étapes grâce à l’accordéon natif sans JavaScript.

Rapport machine actuel : `artifacts/logo-browser-report.json`, avec les rapports propres à chaque navigateur. Les captures des compositions éditoriales sont `logo-link-art-start.png`, `logo-link-art-end.png` et `logo-method-progress.png`, dans `artifacts/`. Les poses `logo-start.png`, `logo-middle.png`, `logo-end.png` et la vidéo `logo-motion.webm` sont régénérées par cette recette. La démonstration courte à présenter est `logo-unfurl.webm`. Les archives `artifacts/logo-original/` et `artifacts/logo-before-unfurl/` conservent les versions antérieures.

Pour reproduire la recette, lancer d’abord le serveur Astro local, puis le script depuis la racine. `BASE_URL` permet de remplacer `http://127.0.0.1:4321` ; `CALAS_LOGO_BROWSER=chromium` ou `firefox` sélectionne un seul moteur. Dans l’environnement Windows utilisé, Firefox a nécessité une exécution autorisée hors sandbox pour démarrer ; cela ne modifie pas le site. Cette recette locale ne vaut ni approbation artistique de Sara et Agnès, ni contrôle des métriques en usage réel.

## Références techniques

Les skills officiels [gsap-core](https://github.com/greensock/gsap-skills/blob/aed9cfd3277740755f6bfc1155c7aa645403b760/skills/gsap-core/SKILL.md), [gsap-timeline](https://github.com/greensock/gsap-skills/blob/aed9cfd3277740755f6bfc1155c7aa645403b760/skills/gsap-timeline/SKILL.md), [gsap-performance](https://github.com/greensock/gsap-skills/blob/aed9cfd3277740755f6bfc1155c7aa645403b760/skills/gsap-performance/SKILL.md) et [gsap-scrolltrigger](https://github.com/greensock/gsap-skills/blob/aed9cfd3277740755f6bfc1155c7aa645403b760/skills/gsap-scrolltrigger/SKILL.md) ont été consultés au commit `aed9cfd3277740755f6bfc1155c7aa645403b760` (licence MIT). Ils guident les timelines, leur portée et leur nettoyage. Documentation de référence : [gsap.matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/) et [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/).

Les versions effectives de GSAP et des polices sont verrouillées dans `pnpm-lock.yaml`. La licence de GSAP est livrée avec son paquet ; les polices Cormorant Garamond et EB Garamond utilisent SIL Open Font License. Aucun Blender, ComfyUI ou générateur d’image n’a été utilisé.
