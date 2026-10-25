# Sanity : raccordement et garanties de cette livraison

État au 25 octobre 2026 : le Studio, les schémas, la couche de lecture et les routes de prévisualisation sont implémentés. Aucun projet Sanity, compte, dataset, jeton ni hébergement Studio de Calas Conseil n’a été fourni ou créé. La compilation du Studio et son contrôle TypeScript ont réussi ; la connexion, l’édition, la publication, la restauration et la prévisualisation authentifiée réelle restent à recetter sur le compte de Calas Conseil. Le build local utilise l’identifiant explicite de configuration `calaslocal` uniquement pour compiler ; ce n’est pas un compte opérationnel.

## Modèle éditorial

### Préparation locale du raccordement

Le 25 octobre, les fichiers locaux du frontend et du Studio ont été préparés, le dataset de test `staging` aligné et une clé privée de session générée sans être affichée. Le site reste en `CONTENT_MODE=demo`. Aucun compte ou projet distant n’a été créé ; il manque le véritable Project ID et les accès API. Les fichiers `.env` restent exclus de Git.

Les commandes suivantes sont destinées à la personne chargée du raccordement, pas à l’usage quotidien de Sara :

```powershell
pnpm cms:prepare
pnpm cms:prepare --project-id IDENTIFIANT_REEL --dataset staging
pnpm cms:check
pnpm cms:check --remote
```

`cms:prepare` ne fait aucun appel réseau, ne publie rien et ne change pas le mode de contenu existant. Il préserve les secrets déjà présents et les autres réglages. Sans identifiant, il prépare les fichiers ; avec un identifiant, il aligne les deux applications. Il refuse un dataset de production et une divergence ambiguë. `cms:check` ne montre jamais les valeurs des jetons ; un code de sortie 1 indique un élément manquant. L’option `--remote`, à utiliser après configuration, vérifie uniquement la lecture publique et authentifiée et compte les documents de base publiés. Elle ne valide ni le rendu complet, ni CORS, ni les droits d’écriture.

| Élément | Emplacement | Utilité |
| --- | --- | --- |
| Compte et projet Calas Conseil | [Sanity Manage](https://www.sanity.io/manage) | Propriété et connexion personnelle au Studio |
| Project ID et dataset public `staging` | Deux fichiers `.env`, alignés par `cms:prepare` | Identifier le contenu du site ; ces deux valeurs ne sont pas secrètes |
| Jeton projet Viewer | `SANITY_API_READ_TOKEN` dans `apps/web/.env` | Lecture des brouillons et prévisualisation côté serveur |
| Jeton projet Editor temporaire | `SANITY_WRITE_TOKEN` dans `apps/web/.env` | Reprise initiale des textes actuels en brouillons, puis révocation |
| Clé de session | `PREVIEW_SESSION_SECRET` dans `apps/web/.env` | Déjà générée localement ; ne pas transmettre |
| Origines locales exactes | Paramètres API/CORS de Sanity | `http://localhost:3333` et `http://localhost:4321`, credentials autorisés pour Studio/Presentation |

Le dataset doit être **public** avec l’architecture actuelle, car les pages publiées se lisent sans jeton. « Public » concerne les documents publiés dans le Content Lake ; les vrais brouillons restent soumis à authentification. Le site web demeure local. Ne placer dans ce dataset que des contenus destinés au site. Les [jetons API Editor et Viewer](https://www.sanity.io/docs/content-lake/roles-concepts) sont distincts des rôles humains et sont disponibles sur tous les forfaits. Les jetons se créent dans les [paramètres API du projet](https://www.sanity.io/docs/content-lake/http-auth), sans communiquer de mot de passe ni copier ces valeurs dans la conversation. Les [origines CORS](https://www.sanity.io/docs/content-lake/cors) doivent être exactes, sans wildcard avec credentials.

Le Studio distingue : coordonnées et qualification centrale, accueil, pages, personnes/auteures, statistiques sourcées, catégories et articles. Les personnes, catégories et statistiques sont référencées. Les sections ne proposent que les formats prévus par le design. Les libellés, aides, aperçus, contrôles d’URL, slugs, longueur et textes alternatifs sont en français. Les paramètres et l’accueil sont des documents uniques. Les pages se créent dans leur rubrique avec leur adresse prévue.

Le nom et la signature de marque sont en lecture seule pour rester cohérents avec les exports du logo. Les titres, introductions et images de Contact et Réflexions s’éditent dans leurs pages. Les annotations de l’accueil et des pages ainsi que l’état vide de Réflexions ont aussi leurs champs éditoriaux. Les formats commerciaux et CTA propres aux offres restent encadrés. Les champs incompatibles déjà remplis restent visibles avec une validation explicite pour permettre leur correction. Le texte mis en forme est disponible dans les sections de type Texte ; les listes structurées appartiennent aux étapes, points clés et idées complémentaires. La présentation « Méthode », « Questions fréquentes » ou « Livrables » est explicite et ne dépend plus d’une clé technique cachée.

Les images sont facultatives pour les pages, sections et bloc Diagnostic de l’accueil ; les portraits et couvertures d’articles gardent leurs emplacements propres. Le rendu utilise des tailles adaptées et respecte le recadrage/point d’intérêt Sanity. Aucun portrait ni article fictif n’est ajouté pour remplir ces champs.

Les articles sont de vrais documents Sanity : un brouillon est identifié par `drafts.*`, pas par une case qui masquerait un document publié. La case « source vérifiée » des statistiques est un contrôle éditorial supplémentaire, pas une permission. La qualification IPRP n’est retournée au rendu que si son état central est vérifié. Aucun message de contact, secret ou justificatif privé ne doit être saisi dans Sanity. Les validations du Studio ne constituent pas un contrôle d’accès API.

Les types du frontend sont dans `apps/web/src/lib/cms/types.ts`, les projections GROQ dans `queries.ts`. Après une évolution du schéma, exécuter :

```powershell
pnpm --filter @calas/studio schema:extract
pnpm --filter @calas/studio typegen
pnpm typecheck
```

## Brancher le compte appartenant à Calas Conseil

1. Sara crée ou reprend la propriété administrative du projet dans son organisation. Confirmer le forfait et les autres comptes autorisés. Créer un dataset de test `staging` distinct du dataset final.
2. Exécuter `pnpm cms:prepare --project-id IDENTIFIANT_REEL --dataset staging`. Les fichiers déjà présents sont conservés ; ne pas les remplacer par les exemples. Le nom d’hébergement du Studio reste vide tant qu’il n’est pas attribué.
3. Renseigner localement le jeton Viewer dans `SANITY_API_READ_TOKEN`, puis vérifier avec `pnpm cms:check --remote`. La clé `PREVIEW_SESSION_SECRET` est déjà générée par la préparation et ne doit pas être affichée. Le mode reste `demo` pendant cette étape.
4. Dans les paramètres Sanity, déclarer précisément les origines du Studio et du frontend utilisées pour la recette ; activer les credentials pour les origines nécessaires à Presentation. Aucun wildcard avec credentials. En préproduction, remplacer les origines locales par les URL HTTPS exactes et autoriser uniquement le Studio dans `frame-ancestors` du frontend.
5. Préparer les 17 brouillons initiaux avec la procédure ci-dessous, puis régler explicitement `CONTENT_MODE=sanity` et redémarrer le frontend. Ouvrir `pnpm dev:studio`. La preview peut montrer les brouillons ; la version publique locale restera indisponible tant que les documents indispensables ne seront pas publiés dans le dataset de test. Utiliser `localhost` pour les deux applications pendant les essais de cookies, puis tester avec les vrais domaines HTTPS.

Le frontend embarque l’intégration officielle `@sanity/astro`. La couche de lecture serveur utilise le client officiel afin de fonctionner aussi dans le mode local explicitement déconnecté. Aucun bundle du Studio n’est monté sur les pages publiques.

## Démarrage des contenus et sauvegardes

### Importer les PDF dans des articles

L’outil Studio **Importer un PDF** utilise PDF.js 6.4.299 et Tesseract.js 7.0.0, chargés à la demande uniquement dans l’administration. Les pages avec texte sont extraites directement ; les pages bitmap peu textuelles ou illisibles passent par l’OCR français/anglais. Une action **Refaire avec reconnaissance complète** couvre les documents hybrides mal détectés. Le titre provient du nom du fichier et le résumé est un extrait littéral, sans génération de contenu ni attribution d’auteure ou de date.

Les workers, les ressources PDF et les modèles sont servis depuis le Studio. `scripts/cms-pdf-assets.mjs`, exécuté avant dev/build/deploy Studio, les copie depuis les dépendances épinglées et crée leur inventaire de versions/licences. `apps/studio/public/ocr/` est généré et exclu de Git ; le lockfile permet de le reconstruire. Aucun moteur PDF/OCR n’est ajouté au frontend public. Aucun service d’OCR externe ou abonnement supplémentaire n’est utilisé.

L’analyse ne téléverse rien. Après aperçu et action **Créer le brouillon**, la session personnelle du Studio envoie le PDF puis crée un nouveau document `drafts.<uuid>` par `createIfNotExists`. Cet import quotidien n’utilise pas le jeton Editor temporaire du seed. L’UUID, le fichier déjà envoyé et le contenu de la première tentative sont conservés pour une reprise sans doublon. Les articles existants ne sont jamais remplacés et aucune publication n’est déclenchée.

L’article contient `sourcePdf` et une confirmation de relecture ; auteur et date doivent être renseignés avant publication. Le site affiche ensuite un lien vers le PDF original avec son poids, après vérification de l’URL CDN et de l’asset. **Les fichiers Sanity sont accessibles par leur URL même si l’article est en brouillon** : l’outil le rappelle avant l’envoi et ne convient pas aux documents confidentiels. Voir la [documentation des assets Sanity](https://www.sanity.io/docs/content-lake/manage-assets).

Limites locales : 20 Mio, 40 pages, 200 000 caractères, rendu OCR plafonné à 2 000 pixels de côté. Les erreurs de lecture, dépassements et délais ne produisent pas de résultat tronqué. Les pages sans texte exploitable sont signalées. La mise en page, les images et tableaux ne sont pas reconstruits fidèlement dans le texte ; ils restent dans le PDF original. Les scans manuscrits ou peu lisibles nécessitent une correction humaine. L’annulation termine les workers, y compris pendant l’initialisation de l’OCR.

Les essais locaux sur PDF synthétiques sont consignés dans `artifacts/pdf-import/report.json`. Le test du composant Studio utilise explicitement des accès Sanity simulés (`studio-report.json`) : il ne prouve ni le téléversement réel, ni les permissions du futur compte. Une séance avec un PDF représentatif du cabinet reste nécessaire après connexion.

### Initialiser les textes déjà présents sur le site

```powershell
pnpm content:seed --dry-run
```

Cette commande vérifie la préparation sans appel réseau. Pour créer les brouillons de départ, le processus doit posséder un `SANITY_WRITE_TOKEN`, les identifiants de projet/dataset et `CALAS_ALLOW_CONTENT_WRITE=yes`, puis exécuter `pnpm content:seed`. Les scripts lisent `.env` puis `apps/web/.env`, sans remplacer une variable de processus déjà définie.

Après cet import ponctuel, révoquer le jeton Editor temporaire, vider `SANITY_WRITE_TOKEN` et remettre `CALAS_ALLOW_CONTENT_WRITE=no`. Les modifications et imports PDF ultérieurs passent par la connexion personnelle au Studio.

Le seed n’écrit que dans `staging`, `development`, `test` ou leurs variantes avec suffixe. Il ne publie rien. Il crée uniquement les contenus absents, en conservant toute version existante, publiée ou brouillon. Des IDs stables sont réservés au catalogue initial pour rendre cette migration idempotente ; les nouveaux contenus saisis dans le Studio gardent les IDs générés par Sanity. Aucun article fictif signé par Sara n’est créé. Après relecture en test, publier d’abord les personnes/statistiques/pages nécessaires puis l’accueil. Les références initiales sont faibles pour permettre la préparation en brouillons ; vérifier leur résolution avant publication.

```powershell
pnpm content:export backups/contenu-2026-10-25.tar.gz
pnpm content:import backups/contenu-2026-10-25.tar.gz
```

L’export utilise `SANITY_EXPORT_TOKEN` ou le jeton de lecture serveur. Il refuse d’écraser un fichier existant. Le CLI officiel inclut documents, brouillons et médias par défaut ; il peut exclure un média distant devenu inaccessible, donc vérifier le compte rendu et restaurer réellement l’archive pour contrôler son intégrité. L’import exige le jeton d’écriture, l’opt-in et un dataset de test **vide**, sans option de remplacement. Les jetons passent par l’environnement du processus, jamais par les arguments. Les scripts ne réimportent rien lors d’un build ou déploiement. Voir aussi la [documentation officielle d’export](https://www.sanity.io/docs/content-lake/exporting-data).

Conserver les archives hors du dépôt dans un emplacement privé appartenant à Calas Conseil. Une restauration validée dans un nouveau dataset, avec contrôle des images, des références, des brouillons et des pages, précède toute bascule manuelle vers un dataset final. Le script fourni refuse toute écriture en production.

## Prévisualisation et cache

Le parcours Presentation appelle `/api/preview/enable`. Le serveur valide le secret de prévisualisation avec `@sanity/preview-url-secret` avant d’émettre une session HMAC d’une heure, HttpOnly, liée au projet et au dataset. La signature et l’expiration sont vérifiées à chaque lecture. `?preview=true`, un cookie inventé ou une perspective arbitraire n’activent jamais les brouillons. Le cookie sécurisé est partitionné quand la requête provient d’une iframe tierce ; `/api/preview/disable` expire les variantes partitionnée et non partitionnée.

La lecture publique utilise explicitement `published`, sans jeton et sans stega ; la lecture privée utilise la perspective signée `drafts` ou `published`, un jeton serveur et `useCdn:false`. Le choix « Publié » de Presentation respecte ainsi la version publiée, tout en restant une preview privée. Les perspectives `raw` et Releases sont refusées ; Releases est désactivé dans ce Studio. La prévisualisation est `private, no-store`, `noindex, nofollow, noarchive`. L’API officielle `enableVisualEditing` et ses styles sont compilés dans une entrée séparée du graphe Astro : `scripts/cms-preview-build.mjs` produit `public/_preview/editor.js` et `editor.css` avant dev/build. Les balises qui les chargent ne sont rendues que dans une réponse dont la session a été vérifiée. Cette séparation empêche Astro de remonter les styles d’édition dans les pages publiques. Ces fichiers techniques ne contiennent aucun jeton ni contenu confidentiel ; la frontière d’accès aux brouillons reste côté serveur. Puisque les noms sont stables, configurer le proxy avec `max-age=0` pour `/_preview/*`.

Les changements de contenu provoquent un rechargement. L’interface est prévue pour les brouillons simples ; les perspectives de Content Releases ne sont pas exposées. Les articles futurs peuvent être prévisualisés mais ne figurent pas dans la lecture publique avant leur date. Après modification de `preview-client.ts` ou de sa feuille de style pendant le développement, relancer `node scripts/cms-preview-build.mjs`.

Les pages publiques Sanity déclarent `public, max-age=0, s-maxage=30, must-revalidate` et `Vary: Cookie`. Il n’y a ni cache applicatif supplémentaire ni CDN Sanity pour les requêtes. Sous un hébergeur respectant ces en-têtes, le budget de cache partagé est de 30 secondes après disponibilité dans le Content Lake ; sans cache partagé, la requête suivante relit Sanity. Aucun webhook d’invalidation n’est utilisé. Ce délai est une configuration à mesurer, pas une mesure acquise. Le proxy doit exclure les réponses privées, respecter `Vary` et ne jamais servir une réponse de prévisualisation à un visiteur. Une panne de lecture renvoie un état indisponible ; elle ne substitue jamais les données locales.

La documentation officielle décrit le [parcours Astro / Presentation](https://www.sanity.io/docs/astro/astro-visual-editing). Cette livraison renforce sa frontière d’authentification avec la session signée. Les [perspectives Sanity](https://www.sanity.io/docs/content-lake/perspectives) sont choisies côté serveur, indépendamment des paramètres du visiteur.

## Forfait à valider

La page tarifaire consultée le 25/10/2026 annonce en Free : 20 sièges, rôles Administrator et Viewer, 2 datasets publics, 10 000 documents, 250 000 requêtes API mensuelles, 1 million de requêtes CDN, 100 Go d’assets et de bande passante. Growth est affiché à 15 USD par siège/mois et ajoute notamment Editor et les datasets privés. L’hébergement Studio est inclus. L’historique de revue des brouillons est annoncé à 3 jours en Free, 90 en Growth ; un historique complet et des sauvegardes avancées ne doivent pas être promis. Aucun abonnement n’a été souscrit. Recontrôler les conditions du compte et le prix avant engagement. [Tarifs Sanity](https://www.sanity.io/pricing)

Sur Free, permettre à Sara de publier signifie lui confier le rôle Administrator ; un rôle éditorial distinct nécessite un choix de forfait. Ne pas confondre la simplification de l’interface avec une réduction des permissions réelles.

## Recette réelle encore requise

Dans Chrome/Edge et WebKit/Safari avec les vrais domaines : modifier un paragraphe, remplacer un portrait et son texte alternatif, créer un article brouillon, ouvrir Presentation, vérifier la mise à jour du brouillon, puis publier dans `staging`. Relever l’heure de publication et la première réponse publique contenant le changement, avec les en-têtes `Age`, `Cache-Control` et `Vary`, jusqu’à expiration des 30 secondes. Pendant la même séquence, une fenêtre privée sans session doit conserver les seules versions publiées. Tester cookie altéré, cookie expiré, paramètre preview, sortie de session, iframe et ouverture directe. Tester l’historique/restauration disponible dans le forfait retenu et un export/import de médias. Ces opérations attendent des identifiants réels et ne sont pas annoncées comme réussies.

## Références de réalisation

Les skills officiels `sanity-best-practices` et `content-modeling-best-practices` ainsi que les guides schémas, références et visual editing ont été consultés dans [sanity-io/agent-toolkit](https://github.com/sanity-io/agent-toolkit/tree/571a2d077554bd1272f31c345ecb7719889e7957), commit `571a2d077554bd1272f31c345ecb7719889e7957` (MIT). Aucun plugin ou MCP global n’a été ajouté. Les versions installées sont verrouillées dans `pnpm-lock.yaml` ; les commandes d’export/import ont été vérifiées avec `--help` du CLI installé.
