# Évolutions du 1er novembre 2026

Le cahier des charges **CAHIER DES CHARGES 311026.pdf**, le document **Symboles_et_images_Calas_Conseil (1).pdf** et les consignes transmises par Paul ont été appliqués au site et à son CMS dans la recette locale le 1er novembre. **Le 2 novembre, sur instruction de Paul, la nouvelle application et les 24 documents ciblés ont été déployés sur la [préproduction Railway](https://calas-web-test-production.up.railway.app/).** La validation de l'accueil et de Diagnostic par Sara et Agnès, puis la relecture générale, restent attendues avant production. Détails dans [DEPLOYMENT.md](DEPLOYMENT.md#nouveau-cahier-des-charges--2-novembre-2026).

## Matrice du brief

| Demande | Réalisation disponible en recette | À compléter ou valider |
| --- | --- | --- |
| Positionnement et premier écran | « Construire la performance durable par la qualité du lien » ; le diagnostic RPS devient une porte d'entrée dans le parcours global | Approbation du message par Sara et Agnès |
| Accueil en sept blocs | Premier écran, Pourquoi maintenant, chemin en trois temps, conviction, binôme, chiffres, invitation finale ; champs éditables dans le CMS | Relecture sur ordinateur et mobile |
| Chemin en trois temps | « Le socle / Diagnostiquer et sécuriser », « L'action au quotidien / Outiller et réguler », « L'ancrage dans la durée / Transformer et pérenniser » ; liens vers Diagnostic, Équipes et Managers | Validation des formulations et des modalités d'accompagnement |
| Diagnostic RPS | Textes, démarche, livrables et confidentialité repris ; numéro IPRP de Sara visible | Relecture métier et contrôle du justificatif IPRP |
| Compétences relationnelles | Présentation, formats et ateliers repris ; durée de conférence « environ 1 h 30 » fournie dans le brief | Prérequis, effectifs et paramètres de chaque atelier lorsqu'ils seront définis |
| Managers | Parcours et rythme mensuel repris du brief ; durée, rythme et modalités restent éditables | Durée globale et modalités finales à confirmer |
| Situations sensibles | Nouvelle page `/situations-sensibles/`, cinq formats, cadre et limites ; accès sous le chemin et dans les offres ; objet de contact associé | Horaires d'appel et délai de réponse à fournir ; aucune permanence d'urgence annoncée |
| Notre approche et le binôme | Textes et biographies détaillées fournis par Sara et Agnès ; données structurées `Person` sur la page du binôme | Relecture des titres, diplômes et biographies ; portraits authentiques |
| Enregistrement IPRP | **Numéro d'enregistrement d'IPRP : 2026.16.004**, attribué à Sara sur l'accueil, Diagnostic et sa présentation | Numéro fourni par Paul, qualification `pending` ; attestation, autorité et validité non vérifiées. Aucun numéro attribué à Agnès |
| Six repères chiffrés | 39 %, 1 sur 2, 8 %, 4,95 %, 38 jours et 9 % ; sources, années et périmètres visibles ; sélection et ordre modifiables | Accepter les corrections sourcées décrites ci-dessous ; actualiser lors des éditions suivantes |
| Réflexions et liens de Sara | Cinq cartes éditables, auteure, dates, aperçus et accès aux originaux LinkedIn ; catégorie « Management et qualité du lien » | Textes intégraux/PDF si une lecture sur Calas est souhaitée ; sixième article et composition de la série à fournir |
| Articles locaux | Édition et import PDF/OCR existants conservés ; données structurées `Article` réservées aux articles natifs | Relire toute extraction PDF ; autoriser séparément le téléchargement de l'original |
| Images et identité | Huit illustrations proposées par Sara, optimisées en WebP ; remplacements CMS dans `home.visuals` ; logo vectoriel et animation existants conservés | Portraits, visage apaisé et photographie d'échange réel à fournir avec leurs droits |
| Navigation et contact | Menu Nos offres, accès aux quatre offres, contact mobile ; organisation, fonction et téléphone facultatifs ; accord explicite non précoché et validé par le serveur | Confirmer horaires, délai et coordonnées définitives avant affichage |
| Domaine et boîtes mail | La discussion suivante retient désormais **calas-conseil.fr** comme nom envisagé et la possibilité de plusieurs adresses, notamment Sara et Agnès ; historique et étapes dans [COURRIEL.md](COURRIEL.md) | Domaine non acheté, boîtes non créées. Nombre d’adresses et offre à confirmer avant achat par Sara ; aucun changement DNS |
| SEO | Pages SSR, métadonnées éditables, liens internes et données structurées adaptées ; relais LinkedIn sans balisage d'article original ni indexation locale | Domaine et zone d'intervention à confirmer ; recette canonicals/sitemap/robots sur la cible définitive |
| Administration et conservation | Reprise locale puis Railway explicite des contenus ; révisions préservées, brouillons privés, publication distincte, images privées avant publication | Accès nominatif de Sara et prise en main sur l'hébergement définitif |
| Sauvegardes et mesures | Sauvegarde/restauration manuelles existantes testées ; aucune mesure d'audience ajoutée pendant cette intervention | Planifier sauvegarde quotidienne, copie hors site, rétention et suivi ; choisir puis raccorder les mesures de visites et demandes prévues au brief |
| Mise en ligne définitive | Nouvelle version disponible en local et sur l'adresse Railway de test depuis le 2 novembre | Revue Sara/Agnès, mentions légales, domaine/courriel, exploitation, puis lancement et recette de la cible définitive |

## Chiffres et articles : choix de reprise

Les chiffres demandés ont été confrontés aux publications officielles. Gallup France 2026 donne 39 % de stress ressenti la veille, 8 % d'engagement et 20 % de désengagement actif, sur une moyenne glissante **2023–2025**. Le stress n'est pas présenté comme nécessairement causé par le travail. Le repère « un salarié sur deux » provient du relais officiel Empreinte Humaine du 2 juin 2026 ; le détail de l'échantillon et des dates de terrain n'est pas fourni sur cette page.

Pour WTW, les deux anciennes valeurs de coût ont été remplacées par les données vérifiées du baromètre **2026 portant sur 2025** : **4,95 %** d'absentéisme et **38 jours** d'absence moyenne. Le groupe est nommé « Les conséquences pour les organisations » afin de ne pas présenter ces deux mesures comme des montants financiers. Le repère mondial Gallup **9 % du PIB** concerne la perte de productivité associée au faible engagement en 2025, pas un coût français. L'assertion sur les managers précise qu'ils expliquent au moins 70 % de la **variance des scores d'engagement entre équipes**, pas 70 % de l'engagement d'une personne. Formulations, périmètres, références et historique : [SOURCES.md](SOURCES.md).

Les cinq articles LinkedIn restent des publications externes de Sara. Les cartes Calas en donnent un aperçu éditorial et un lien vers l'original ; aucun texte intégral, PDF ni visuel LinkedIn n'a été importé. Une future version locale peut être créée à partir du texte validé ou d'un PDF fourni, puis relue et publiée. Les cinq liens reçus ne suffisent pas à déclarer complète la série de six articles du brief. Inventaire : [ARTICLES-LINKEDIN.md](ARTICLES-LINKEDIN.md).

## Sélection des images

Le PDF de Sara propose des esquisses cohérentes, or-bronze sur crème, et autorise leur reprise comme illustrations. Ces **huit visuels fournis** ont été retenus pour conserver cette cohérence et respecter les emplacements indiqués. Les originaux extraits sont conservés dans `assets/editorial/symbols/` ; leurs versions d'affichage sont dans `apps/web/public/images/symbols/`, en WebP de 900 × 520 pixels. Lors de cette reprise du 1er novembre, aucune photo générique ni aucun visage inventé n’avait été ajouté. Les compléments photographiques reçus puis sélectionnés le 2 novembre sont distingués ci-dessous et dans [MEDIA.md](MEDIA.md).

| Original PNG → image WebP | Placement retenu | Raison donnée dans le document |
| --- | --- | --- |
| `threads.png` → `threads.webp` | Bandeau discret du premier écran | Le lien se construit par le tissage |
| `nautilus.png` → `nautilus.webp` | Pourquoi maintenant | Grandir en restant soi-même |
| `roots.png` → `roots.webp` | Carte Le socle et ouverture de Diagnostic | Voir ce qui tient sous la surface |
| `compass.png` → `compass.webp` | Carte L'action au quotidien et ouverture d'Équipes | S'orienter grâce aux émotions |
| `tree.png` → `tree.webp` | Carte L'ancrage dans la durée et ouverture de Managers | Ce qui prend racine porte des fruits |
| `kintsugi.png` → `kintsugi.webp` | Lien et ouverture de Situations sensibles | Réparer le lien sans dramatiser |
| `ripples.png` → `ripples.webp` | Notre conviction, émotions | L'émotion se propage au collectif |
| `murmuration.png` → `murmuration.webp` | Notre conviction, autonomie, et ouverture de Notre approche | Un collectif vivant, autonome et relié |

Les images décoratives par défaut ont un texte alternatif vide et ne répètent pas les titres aux lecteurs d'écran. Les images de remplacement utilisent les textes alternatifs et cadrages du CMS. Dans **Accueil → Images de l'accueil**, chaque symbole peut être remplacé ; retirer le remplacement rétablit le visuel fourni. Une photographie peut aussi être ajoutée à l'invitation finale. Les portraits s'éditent dans **Équipe**. Aucune image n'est ajoutée au bloc des chiffres.

Le document demande également des visages réels : Sara et Agnès, un visage apaisé et des collègues en échange. Lors de la reprise du 1er novembre, ces photographies n’avaient pas été fournies ; les huit illustrations n’étaient donc pas présentées comme l’exécution complète du volet photographique. Le portrait réel de Sara a depuis été reçu et publié. Les deux photographies d’illustration sont sélectionnées pour les nouvelles corrections du 2 novembre, avec provenance et licences dans [MEDIA.md](MEDIA.md#photographies-dillustration--corrections-du-2-novembre-2026). Le portrait d’Agnès reste à fournir.

## Reprise et vérification locale

La correction datée a publié explicitement les **24 documents ciblés** dans PostgreSQL local, en conservant l'historique et les autres documents. Le [rapport après reprise](../artifacts/brief-20261101/local-content-report.json) confirme les six statistiques, les cinq articles, la nouvelle page publiée, le numéro IPRP avec statut `pending`, l'absence de correction restante et l'idempotence. La méthode, ses gardes et ses commandes sont documentées dans [MIGRATION.md](MIGRATION.md#cahier-des-charges-du-31-octobre--reprise-locale-du-1er-novembre-2026).

Contrôles achevés et confirmés pour cette reprise :

- 49 contrôles CMS locaux et 26 contrôles d'intégration PostgreSQL, S3, sauvegarde/restauration et rôle applicatif ;
- 37 scénarios publics distincts, dont 26 Chromium et 11 Firefox : 36 succès au premier passage, puis réussite du contrôle des images après adaptation du test aux images masquées sur mobile ;
- huit tests unitaires de correction du brief et un test de migration réelle en base ;
- huit tests unitaires du contact et deux contrôles en base des références d'images de l'accueil ;
- contrôles de marque : 1 515 états géométriques du mouvement actuel, 70 états de rubans et 22 mesures d'apparition progressive de l'étude antérieure conservée, tous réussis ;
- typecheck sans erreur ni avertissement, 18 indications de dépréciation préexistantes ; lint et build réussis ;
- [rendu depuis la base CMS réelle](../artifacts/brief-20261101/local-render-report.json) vérifié : six statistiques, cinq articles, numéro IPRP, trois limites de Situations sensibles et refus HTTP 401 de l'administration anonyme.

La revue de l’administration a ensuite validé six audits axe à 390 et 1 440 pixels (accueil, paramètres et article LinkedIn), sans violation, débordement ni erreur JavaScript. La connexion mot de passe + TOTP est réelle ; aucun contenu n’a été modifié. Deux champs en lecture seule ont reçu une couleur plus contrastée avant le dernier build et la recette finale. Rapport : [administration](../artifacts/brief-20261101/admin-report.json).

Les résultats historiques d'octobre restent consignés séparément. Aucun résultat local ne vaut validation des textes par Sara et Agnès, activation des emails, déploiement Railway de cette évolution ou recette de production. Les prochaines décisions sont consignées dans [VALIDATION.md](VALIDATION.md), et les gestes d'édition dans [GUIDE-SARA.md](GUIDE-SARA.md).

Synthèse de cette recette : [rapport](../artifacts/brief-20261101/validation-summary.json). Les captures complètes responsive sont dans `artifacts/brief-20261101/responsive/` ; un dossier distinct a évité les verrous temporaires Windows sur les anciennes images de référence.


## Vérification Railway du 2 novembre

La version finale 77493b1 est déployée après correction d'un encadré trop étroit sur mobile. Les 24 documents ciblés sont publiés, l'historique et les autres documents sont conservés, et la vérification idempotente constate zéro correction restante. La recette distante réussit 30 contrôles publics, huit rendus et huit audits d'accessibilité, plus six audits de l'administration avec connexion réelle. Aucun email, achat de domaine ou changement d'identifiant n'a eu lieu. Détails dans [DEPLOYMENT.md](DEPLOYMENT.md#nouveau-cahier-des-charges--2-novembre-2026).


## Complément photographique reçu le 2 novembre

Le portrait de Sara est désormais fourni et publié sur l'accueil et Qui sommes-nous. Le bol réparé illustre Situations sensibles et la photo des ondes remplace l'esquisse correspondante dans Notre conviction. Les bobines et la boussole reçues restent disponibles dans la médiathèque privée. Le portrait d'Agnès et les photos d'atelier restent à fournir. Cette intégration utilise les champs CMS existants, sans déploiement applicatif ; provenance et choix dans [MEDIA.md](MEDIA.md#photos-fournies-pour-sara--2-novembre-2026).
