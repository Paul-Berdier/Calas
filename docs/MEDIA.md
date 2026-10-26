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
