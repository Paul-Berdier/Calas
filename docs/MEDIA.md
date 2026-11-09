# Médias privés et import PDF du CMS Calas Conseil

## Stockage et accès

Le navigateur envoie les fichiers à l’application Astro, après vérification de la session Better Auth, du rôle, du deuxième facteur et de l’origine. Les fichiers sont conservés dans un bucket S3 privé. Le disque éphémère de l’application ne conserve aucun upload. Les clés du bucket et les noms des objets restent côté serveur.

`GET /media/{identifiant}/` vérifie à chaque requête soit une référence de publication active, soit les droits de la session. Un éditeur peut lire ses fichiers privés et les médias déjà publiés ; un administrateur peut gérer l’ensemble de la médiathèque. Un identifiant connu ne donne pas accès à un média privé. L’accès anonyme refusé produit une réponse 404 sans cache. Les réponses privées utilisent `private, no-store`. Les réponses publiques doivent être revalidées, afin qu’une dépublication révoque leur accès.

La publication met à jour les références d’accès dans la même transaction que le contenu. Pour un PDF, la publication de l’article ne suffit pas : l’autorisation « Proposer le téléchargement du PDF » doit être activée. Le téléchargement reçoit `Content-Disposition: attachment`, `nosniff` et une CSP restrictive. Le serveur ne redirige pas vers le bucket et ne délivre pas d’URL S3 signée au visiteur.

## Limites et traitements

| Fichier | Limites et traitement |
| --- | --- |
| JPEG, PNG, WebP | 12 Mio à l’entrée, 32 millions de pixels, 12 000 pixels par côté, une seule image fixe |
| Images stockées | Décodage Sharp, orientation EXIF appliquée, réencodage JPEG ou PNG sans métadonnées, taille résultante limitée à 20 Mio |
| Variantes | Trois variantes WebP, largeurs cibles 320/960/1920, sans agrandissement ; aucune variante arbitraire créée par une URL |
| PDF | 20 Mio, 40 pages, signature réelle puis analyse PDF.js dans un worker Node limité en durée et mémoire |
| Formats refusés | SVG utilisateurs, exécutables, formats inconnus, images invalides ou animées, PDF invalides ou protégés |
| Import éditorial PDF | 200 000 caractères maximum ; toute erreur de limite refuse l’import complet, sans troncature silencieuse |

Le sélecteur d’image conserve le texte alternatif et le point d’intérêt par utilisation dans le contenu. Une modification d’un brouillon ne recadre donc pas automatiquement les autres pages. Le rendu public utilise les variantes disponibles et le point d’intérêt du contenu.

Les uploads sont limités à 20 tentatives par minute et par compte, avec compteur PostgreSQL partagé entre instances. L’enveloppe multipart est limitée par lecture de flux, même sans `Content-Length`. Les clés de stockage sont générées par le serveur ; le nom original, nettoyé, sert uniquement à la présentation et au téléchargement.

## Remplacement, suppression et incidents

L’upload utilise un identifiant de tentative stable et un verrou transactionnel PostgreSQL. Deux clics ou une réponse réseau perdue ne créent pas deux médias. Une nouvelle requête avec le même identifiant et un autre fichier est refusée.

La modification du texte alternatif vérifie la date de la version ouverte. Une mise à jour concurrente produit un conflit, sans écrasement silencieux. Le remplacement d’une image partagée conserve son identifiant, mais exige une confirmation explicite d’un administrateur : le changement concerne ses utilisations existantes, y compris les révisions historiques qui gardent cet identifiant. Restaurer une version de texte ne restaure donc pas automatiquement l’ancien fichier binaire. Pour conserver deux visuels distincts dans les versions, importer une nouvelle image au lieu de remplacer l’ancienne. Les anciens objets sont conservés dans les métadonnées de maintenance et inclus dans l’inventaire des sauvegardes. Un PDF déjà référencé doit être importé comme nouveau fichier dans un brouillon, puis autorisé et publié à nouveau.

La suppression refuse tout média référencé, y compris par une ancienne révision. Pour un média inutilisé, PostgreSQL enregistre une demande de nettoyage dans `media_deletions` et retire sa fiche dans une transaction. L’objet S3 est ensuite supprimé. Une panne du stockage laisse une demande de nettoyage à reprendre ; l’interface signale cette situation. L’endpoint administrateur `POST /api/admin/media/cleanup/` reprend jusqu’à 50 demandes, avec session complète et contrôle d’origine. Il n’est pas appelé automatiquement par le build.

Une panne dont le résultat de commit PostgreSQL est inconnu ne provoque jamais la suppression aveugle des objets déjà envoyés : cela pourrait détruire un média réellement enregistré. Des objets privés orphelins peuvent donc subsister après un incident exceptionnel. Leur inventaire fait partie des sauvegardes ; leur purge exige un rapprochement de maintenance, pas une suppression automatique pendant une requête éditoriale.

## Importer un PDF

1. Dans Réflexions, ouvrir « Importer un PDF » et choisir le document.
2. Le navigateur extrait le texte. Les pages scannées utilisent les modèles français/anglais fournis avec l’application, sans API externe.
3. Vérifier le résultat. La reconnaissance complète permet de retraiter un document mixte dont certaines zones n’ont pas été reconnues. Le titre, le résumé et le texte peuvent être corrigés.
4. « Créer le brouillon » téléverse le PDF privé, puis crée un article Tiptap. Le même identifiant de tentative est conservé si une réponse est perdue.
5. Ouvrir l’article et compléter l’auteure, la catégorie et la date. Confirmer la relecture et, si souhaité, autoriser le téléchargement du PDF. La publication est bloquée tant que les validations éditoriales nécessaires manquent.

Les images, tableaux et colonnes du PDF ne sont pas reproduits fidèlement dans le texte éditable. Le document original reste disponible comme pièce jointe. Aucun auteur, aucune date ni paragraphe absent du document n’est inventé.

## Configuration technique

Variables serveur : `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`. Un endpoint distant exige HTTPS. `S3_FORCE_PATH_STYLE=true` convient au MinIO local ; adapter ce réglage au fournisseur retenu.

Pour le service local uniquement, après le démarrage de Docker :

```powershell
node scripts/media-storage-setup.mjs --local
node scripts/pdf-assets.mjs
```

La première commande refuse les endpoints distants et les environnements autres que développement/test. Elle crée uniquement le bucket privé local s’il manque. La seconde copie les ressources PDF.js/Tesseract depuis les paquets installés vers `apps/web/public/ocr/`. Ce répertoire généré est exclu de Git. Les ressources OCR sont chargées à la demande dans l’administration, jamais par les pages publiques.

## Vérifications exécutées

Le 25 octobre 2026, les vérifications propres à ce module ont donné :

- **16 tests Node réussis**, sans saut : validation réelle Sharp/PDF.js, streaming multipart, Tiptap, base PostgreSQL isolée et stockage MinIO réel. Les tests couvrent notamment le refus S3 anonyme (403), le média privé via Astro (404), l’idempotence concurrente, les rôles, les conflits, les droits de téléchargement, la dépublication, les références historiques et le remplacement/suppression.
- **6 cas Chromium réussis** sur le moteur PDF/OCR migré : texte, scan, mixte, reconnaissance forcée, document invalide et annulation pendant le chargement des modèles. Aucune requête externe observée.
- **5 contrôles Chromium du composant réel**, avec réponses HTTP simulées uniquement pour reproduire une perte de réponse : absence d’upload avant confirmation, double clic, reprise du même article, ouverture et absence de débordement aux largeurs 360/390/768/1280/1440.
- **8 tests historiques adaptés** au document Tiptap et à la validation du nouveau backend : limites, ordre du texte, détection OCR, brouillon privé et relecture obligatoire.
- **Parcours authentifié réel en 20 étapes**, sans réponse simulée : import, édition Tiptap, auteur/catégorie/date, aperçu privé, publication, téléchargement explicitement autorisé, modification privée, deuxième publication et restauration. La même recette vérifie une image privée, son texte alternatif et point d’intérêt, le remplacement à identifiant stable, le refus de suppression référencée et la suppression d’un fichier inutilisé. Les seules données de recette sont archivées à la fin ; le PDF redevient inaccessible au public. Les captures ont été contrôlées, notamment à 360 px.

```powershell
$env:CALAS_MEDIA_INTEGRATION='yes'
pnpm --filter @calas/web exec tsx --test ../../tests/media.test.ts ../../tests/media-db.test.ts
node scripts/pdf-cms-browser-check.mjs
node scripts/pdf-cms-ui-check.mjs
# Après création d’une session de recette locale via auth-browser-check.mjs :
node scripts/pdf-editorial-e2e.mjs
```

Les tests d’intégration créent puis suppriment leur propre base locale nommée `calas_media_test_*`. Ils ne modifient pas les contenus éditoriaux de la base de développement. Les objets S3 synthétiques qu’ils créent sont nettoyés à la fin.

Rapports et captures : `artifacts/custom-cms/pdf-import/` et `artifacts/custom-cms/editorial-e2e/`. La session de test `.cache/admin-state.json` reste privée et ignorée par Git. La recette générale de l’administration est documentée dans `docs/RECETTE.md`. Ces vérifications locales ne revendiquent ni un raccordement Railway Buckets, ni un stockage distant de production.


## Photos fournies pour Sara — 2 novembre 2026

Paul a transmis l'archive ma_photo_profil_et_images_site.zip, contenant cinq images. Elles ont été importées par les API authentifiées du CMS en local puis sur la préproduction Railway. Les originaux reçus sont conservés dans le dossier opérateur privé, hors Git. L'image AVIF des ondes a été convertie en WebP sans perte avant l'import ; aucune retouche générative ni modification des visages. Le CMS applique ensuite son traitement habituel et ses variantes responsives.

| Fichier reçu | Usage retenu |
| --- | --- |
| portrait_fond_naturel.png | Portrait de Sara Serrano Cabeza : accueil et Qui sommes-nous, cadre 4/5, point d'intérêt 50 % / 44 % |
| kintsugi-art-japonais-bol-repare-or.webp | Lien Situations sensibles sur l'accueil et image d'ouverture de cette page |
| pexels-photo-36744232.avif | Ondes sur l'eau dans le bloc Notre conviction de l'accueil |
| Fils-Dores-Tissage-Ethchic.webp | Réserve dans la médiathèque privée, sans référence publiée |
| stickers-vintage-boussole-se-situe-sur-une-ancienne-carte-du-monde.jpg.jpg | Réserve dans la médiathèque privée, sans référence publiée |

Le bol illustre la réparation du lien et les ondes sa propagation. Les dessins existants de tissage et de boussole restent en place : ils servent mieux la lecture de ces emplacements que les bobines de produit et la carte ancienne. Le portrait d'Agnès n'a pas été fourni ; sa présentation typographique reste inchangée. Tous les médias sont remplaçables dans l'administration.

Seuls les champs d'images de trois documents ont changé : Sara, Accueil et Situations sensibles. Chaque opération utilise un instantané préalable, les versions attendues et une publication explicite. Les anciennes révisions et tous les autres champs sont vérifiés inchangés. Les cinq médias sont inaccessibles anonymement avant publication ; seuls les trois retenus deviennent publics. Les deux réserves restent en HTTP 404 pour un visiteur anonyme. Aucun compte, courriel, code applicatif ni configuration Railway n'a été modifié. Rapports : artifacts/sara-images-20261102/.

Vérification du rendu après publication : six vues en local et six sur Railway (accueil, Qui sommes-nous, Situations sensibles à 390/1440 pixels), sans violation axe, débordement ni erreur JavaScript/HTTP. Portrait chargé, cadre 4/5 et point d'intérêt conservés ; photos de conviction et kintsugi présentes. Cadrages relus visuellement. Typecheck : zéro erreur, zéro avertissement, 18 indications de dépréciation existantes ; lint réussi. Aucun rebuild ni redéploiement n'est nécessaire pour ces changements de contenu. Les sessions opérateur dédiées ont été déconnectées ; le serveur local de test4336 arrêté, l'aperçu4321 reste disponible.

## Photographies d’illustration — corrections du 2 novembre 2026

Le document « CORRECTIONS SITE AU 02-11.pdf » demande des photographies réelles de banque d’images et la vérification de leur licence commerciale. Les deux images ci-dessous ont été sélectionnées et inspectées le 2 novembre : adultes, lumière naturelle, absence de marque visible. Aucun visage n’a été généré ou retouché par IA pour cette sélection. Ces scènes illustrent les propos du site ; elles ne représentent ni Sara et Agnès, ni des clientes, ni une intervention du cabinet.

| Emplacement CMS | Photographie et auteur | Source et licence vérifiées | Fichier préparé et cadrage |
| --- | --- | --- | --- |
| `home.visuals.calmFace` — fin de Notre conviction, retirée ensuite à la demande de Paul | Visage aux yeux fermés dans une lumière chaude ; Anna Blake | [Photo originale sur Unsplash](https://unsplash.com/photos/serene-woman-with-closed-eyes-embracing-herself-in-sunlight-hMn55KZIoiY), publiée le 21 juillet 2026 ; [licence Unsplash](https://unsplash.com/license) | `calm-anna.jpg`, 1 800 × 2 400 ; point d’intérêt initial 56 % / 36 % |
| `home.visuals.closing` — invitation finale | Deux collègues échangeant autour d’une table lumineuse ; Christina Morillo | [Photo originale sur Pexels](https://www.pexels.com/photo/photography-of-women-talking-to-each-other-1181717/), publiée le 22 juin 2018 ; [licence Pexels](https://www.pexels.com/license/) | `team-christina-1181717.jpg`, 1 800 × 1 200 ; point d’intérêt 50 % / 40 % |

Chaque page de photographie indique une licence gratuite. Les licences officielles autorisent leur utilisation sur un site commercial sans achat ; elles ont été consultées le 2 novembre 2026. L’attribution est facultative, mais les crédits sont conservés. Pour Pexels, l’usage ne doit notamment pas laisser entendre que les personnes recommandent le cabinet ni les présenter de manière dévalorisante. Aucun statut de cliente, témoignage ou résultat d’accompagnement ne leur est attribué.

Les fichiers et le manifeste opérateur sont préparés dans `.cache/corrections-20261102/photos/selection.json`. Le manifeste consigne pour chaque image la page source, l’auteur, la licence, la date de vérification, l’URL de téléchargement, les dimensions, l’empreinte SHA-256, le texte alternatif et le point d’intérêt. Les fichiers sources ne sont pas des images servies directement depuis ce dossier privé ; leur utilisation sur le site suit le circuit normal de la médiathèque CMS et de la publication explicite.

Textes alternatifs retenus : « Une femme, les yeux fermés, profite de la lumière naturelle en extérieur. » et « Deux collègues échangent en souriant autour d’une table, dans un bureau lumineux. ». Les crédits sont « Photo d’illustration : Anna Blake / Unsplash. » et « Photo d’illustration : Christina Morillo / Pexels. ».

Le champ `calmFace` porte à dix le nombre de visuels éditables de l’accueil. Il est facultatif, comme `closing` : sans référence média, aucune photographie n’est affichée à cet emplacement. Les autres huit champs gardent leur illustration de remplacement habituelle. Le portrait réel de Sara reste celui fourni par Paul. Celui d’Agnès reste à recevoir.

Les deux photographies ont d’abord été importées dans les médiathèques locale et Railway puis publiées avec l’accueil v9. Leur accès anonyme était refusé avant cette publication et autorisé après ; les autres médias et l’historique ont été conservés. La photo apaisée utilisait un cadre portrait 4/5 de 440 pixels au maximum ; la scène finale conserve son ratio 3/2 et une largeur maximale de 960 pixels pour ne couper aucun visage. Les rapports et la provenance de cette première livraison sont dans `artifacts/corrections-20261102/`.

Paul a ensuite demandé explicitement de retirer la photo de la femme rousse. Seule la référence `home.visuals.calmFace` a été retirée puis publiée le 2 novembre, en local et sur Railway : accueil v9 → v11. Le fichier reste dans la médiathèque privée et dans les révisions antérieures, sans être accessible aux visiteurs (HTTP 404 vérifié). La photo d’échange entre collègues reste publique (HTTP 200), ainsi que le portrait authentique de Sara ; tous les autres champs et les anciennes révisions sont identiques. Le champ facultatif `calmFace` est désormais vide : aucun cadre ni espace photographique vide n’est rendu. Aucun remplacement n’a été demandé ou ajouté. Preuves : `artifacts/revision-brand-20261102/photo-removal/`.

## Illustrations photographiques du 9 novembre 2026

Les deux documents transmis pour la mise en ligne demandent des photos proches des symboles et un trait doré en remplacement du tissage. Les cinq illustrations ci-dessous ont été créées avec ImageGen pour Calas Conseil. Elles représentent des sujets symboliques. La boussole proposée dans l’archive de Sara porte un filigrane de boutique. La version créée pour le site évite d’utiliser cette photographie commerciale.

| Sujet | Fichier WebP dans `apps/web/public/images/photographies/` | Utilisation |
| --- | --- | --- |
| Nautile en coupe | `nautilus.webp` | Pourquoi maintenant, Qui sommes-nous |
| Racines d’un hêtre | `roots.webp` | Diagnostic |
| Boussole en laiton | `compass.webp` | Compétences relationnelles |
| Chêne dans une prairie | `tree.webp` | Managers et dirigeants |
| Vol d’étourneaux | `murmuration.webp` | Notre parti pris, Notre approche |

Les originaux PNG sont conservés dans le dossier local de génération `01a1be73-5ad0-7cb2-85d4-3ac260d3fe97`. Les WebP (960 × 640) sont inclus dans les sources du site. La médiathèque contient également les cinq images, avec leur texte alternatif. Les champs **Images de l’accueil** permettent de les remplacer, et une page offre peut toujours choisir son propre visuel. La version publiée v15 de l’accueil conserve les médias existants de Sara et les neuf références statistiques. Le portrait de Sara et le bol kintsugi proviennent toujours de son archive.
