# Revue éditoriale et autorisation de publication

## Recette demandée après réparation SMTP — 12 novembre 2026

Paul demande les tests après l’activation de l’envoi réel. Une campagne technique dédiée est créée pour sa seule adresse de recette, avec sélection unique et confirmation dans l’administration. Le message « Test Calas — campagne réelle du 12 novembre à 00:31 » est accepté par OVH via le traitement intégré au service Railway : un envoi, aucune erreur ni issue incertaine. Le lien ouvre Diagnostic, son arrivée et sa consultation remontent dans la campagne technique ; aucun cookie ou stockage navigateur de mesure, et l’arrêt de la mesure fonctionne. Cette campagne est ensuite mise en pause, historique conservé. Aucun message à Sara, Agnès ou à un prospect externe. Paul confirme ensuite la réception dans les courriers indésirables de Hotmail. La réception effective est donc vérifiée, mais la délivrabilité en boîte principale reste un point non résolu. Les tests techniques réussis ne valent pas validation du classement antispam ; les en-têtes de ce message n’ont pas été analysés et sa cause de classement n’est pas établie.

Les 64 tests locaux ciblés passent sans saut, ainsi que les 12 contrôles d’interface/accessibilité à 390 et 1440 pixels. Les deux transports MCP sont testés sur le domaine réel avec le SDK officiel : 31 outils sur chacun, identité administrateur, consentement OAuth/PKCE, renouvellement, révocation immédiate et refus des clés croisées. Les accès de recette et leur session sont révoqués ; le client OAuth technique reste enregistré sans autorisation active. Aucun raccordement aux comptes personnels ChatGPT/Claude n’est déduit des tests de protocole. Aucune modification applicative ou nouveau déploiement n’est nécessaire.

Preuves : `artifacts/outreach/campaign-live-20261112.json`, `mcp-live-20261112.json`, `regression-20261112.json` et `artifacts/outreach-ui/report.json`.

## Prospection et connexions IA — 11 novembre 2026

La demande comprend les imports Excel/CSV/TXT, les campagnes, un lien d’arrivée directe sur le site et les accès MCP locaux et distants. Les compteurs représentent des arrivées et consultations, sans déduire un nombre de personnes uniques ou des ouvertures d’e-mails. Les contacts suggérés par une IA doivent conserver une provenance vérifiable.

Les parcours locaux vérifient la connexion réelle, le traitement automatique simulé dans le service web, les oppositions, les permissions et la révocation OAuth. Le rapport navigateur est `artifacts/outreach/http.json` ; les dix vues d’administration sont dans `artifacts/outreach-ui/`. Aucun e-mail externe ni compte IA personnel n’a été utilisé pour ces essais.

- [x] Mise en ligne de cette évolution autorisée par Paul (« ajoute le à mon projet calas »), sans nouveau service ni abonnement ; déploiement `9f5673cf-ec74-4e4f-bb14-6eb75596fc4d` réussi.
- [x] Notice de confidentialité contrôlée puis publiée explicitement ; autres sections et anciennes révisions conservées.
- [ ] Connexion effective aux comptes ChatGPT/Claude/Codex souhaités après déploiement HTTPS.
- [ ] Source, pertinence professionnelle, message et destinataires contrôlés avant la première campagne réelle ; quotas OVH vérifiés.

La première demande d’explication de Paul n’avait pas été traitée comme une autorisation. Sa demande ultérieure d’ajout au projet Calas autorise la solution intégrée au service existant. Aucun achat ni changement d’offre n’a été effectué. Les 24 contrôles publics et six groupes authentifiés distants passent ; les données de recette ont été retirées et les accès temporaires révoqués. Cette recette ne vaut pas raccordement aux comptes personnels ChatGPT/Claude ni autorisation d’une campagne réelle. Les autres décisions historiques ci-dessous sont conservées.

## Lancement autorisé le 9 novembre 2026

Paul a autorisé le lancement sur **www.calas-conseil.fr**, confirmé les identités des deux EI, les responsabilités de Sara, les destinataires du formulaire et la conservation des demandes. Il a autorisé un essai à la boîte partagée. La racine du domaine en HTTPS est hors du périmètre retenu. Les avis et cases de relecture ci-dessous décrivent les versions historiques.

État de départ : développement local. Le 25 octobre 2026, Paul a ensuite autorisé une préproduction publique dans le projet Railway Calas, avec PostgreSQL, stockage privé et compte de recette sans email externe. [Cette adresse](https://calas-web-test-production.up.railway.app/) permet la relecture ; ce n’est pas une validation de production. Le brief exige la validation de l'accueil et de Diagnostic par Sara et Agnès, puis une relecture générale avant lancement définitif. Ce document est une liste de décision ; les résultats réellement exécutés sont consignés séparément dans le compte rendu de tests.

**État au 2 novembre 2026 :** sur demande explicite de Paul, le nouveau cahier des charges du 31 octobre et ses consignes ont été déployés sur la **préproduction Railway**, après la recette locale. Les 24 documents ciblés sont publiés sur cette adresse de test, avec conservation de l'historique. La matrice [Évolutions du 1er novembre](EVOLUTIONS-20261101.md) distingue ce qui est appliqué, les pièces manquantes et les raccordements encore attendus. Les cases ci-dessous restent des décisions de Sara et Agnès ; le déploiement de recette et ses tests techniques ne les cochent pas à leur place.

## Attestation RPPS d’Agnès reçue le 3 novembre 2026

Le justificatif `attestation_10009722090.pdf`, fourni par Paul et édité le 23 août 2026, porte le nom **LOUPIAS AGNES**, la profession **Psychologue** et le numéro **RPPS 10009722090**. La présentation de recette ajoute « Enregistrement RPPS n° 10009722090 » et précise la date de l’attestation dans la biographie. Il s’agit d’un enregistrement professionnel, sans nouveau diplôme ni enregistrement IPRP déduit. Les mentions antérieures du master et de la spécialité clinique restent issues du brief, pas de cette attestation. Le justificatif original n’est pas rendu téléchargeable.

- [x] Révision CMS d’Agnès publiée sur la préproduction Railway (v3 → v5), historique conservé et fiche de Sara inchangée. L’accueil et Qui sommes-nous répondent 200 et affichent l’enregistrement RPPS ; présentation d’Agnès relue visuellement sur ordinateur, sans débordement à 1 280 px. La tentative de contrôle à 390 px n’a pas changé la largeur effective du navigateur : elle ne constitue pas une validation mobile. Typecheck et lint réussis. Preuves : `artifacts/agnes-rpps-20261103/`. Cette vérification technique ne vaut pas validation du lancement définitif.

## Corrections reçues le 2 novembre — appliquées en préproduction

Le document « CORRECTIONS SITE AU 02-11.pdf » demande un fond bleu nuit, une adaptation du lettrage Calas Conseil selon sa référence, trois phrases d’ouverture en gras et italique, la phrase finale de Notre conviction en italique, l’ajout du signe IPRP fourni et les photographies prévues. Les champs éditoriaux `journey.cards[].lead`, `conviction.closingQuote` et `home.visuals.calmFace` sont intégrés au code local et à l’administration. Le guide décrit les dix champs d’images de l’accueil. Deux photographies d’illustration ont d’abord été sélectionnées puis publiées ; leurs licences, sources et le retrait ultérieur de l’une d’elles sont consignés dans [MEDIA.md](MEDIA.md#photographies-dillustration--corrections-du-2-novembre-2026).

La recette de la première livraison est réussie : typecheck, lint, build, 15 tests ciblés, 3 scénarios navigateur et contrôles publics/admin à 390/1440 px. Les deux documents corrigés et les deux photos ont été publiés en local et sur Railway, avec historique préservé. Le site distant et son administration ont également passé les contrôles d’affichage et d’accessibilité, les 26 contrôles du logo sous Chromium/Firefox et les menus sans JavaScript. Résultats : `artifacts/corrections-20261102/`. Ces vérifications techniques ne remplacent pas les décisions éditoriales ci-dessous.

Paul a ensuite demandé de retirer la photo de la femme rousse et a refusé le résultat du lettrage du bandeau. Le retrait de `calmFace` est appliqué en local et sur Railway (accueil v9 → v11) : fichier conservé privé, anciennes révisions et autres contenus inchangés, aucun remplacement ajouté. Le champ reste disponible dans l’administration mais vide. La nouvelle reprise typographique est en cours de vérification ; elle n’est pas déclarée validée par ces résultats historiques.

- [ ] Vérifier les textes corrigés, leur séparation en paragraphes et les mises en forme sur les trois cartes et dans Notre conviction.
- [ ] Relire le fond bleu nuit, le lettrage et le signe IPRP sur ordinateur et téléphone ; le numéro reste attribué à Sara, sans attestation déclarée vérifiée.
- [x] Retirer la photo de la femme rousse conformément à la demande de Paul : vérifié en local et sur Railway, sans cadre vide.
- [ ] Valider le cadrage de l’échange entre collègues, conservé comme photographie d’illustration.
- [x] Confirmer que l’administration permet de modifier les nouveaux champs et conserve les brouillons, publications et versions antérieures : vérifié en local et sur Railway.
- [x] Consigner les résultats de typecheck, lint et des tests adaptés, dont le logo en mouvement réduit et sans JavaScript.

## Revue 1 — Accueil et Diagnostic

À examiner ensemble sur ordinateur et mobile, à partir des captures de recette et du [site de test Railway](https://calas-web-test-production.up.railway.app/) :

- [ ] Le nom comporte un seul s ; la signature, les proportions du coquillage et la dorure sont approuvées.
- [ ] Le nouveau titre « Construire la performance durable par la qualité du lien » et les sept blocs sont approuvés : premier écran, Pourquoi maintenant, chemin en trois temps, conviction, binôme, chiffres, invitation finale.
- [ ] Le diagnostic et la prévention des RPS constituent une porte d'entrée dans l'offre de transformation par la qualité du lien, sans réduire l'identité du cabinet aux RPS.
- [ ] Les trois cartes « Diagnostiquer et sécuriser », « Outiller et réguler », « Transformer et pérenniser » et l'accès aux situations sensibles racontent clairement le parcours.
- [ ] La qualité du lien différencie le cabinet sans réduire les difficultés aux émotions individuelles ; les textes de Notre approche et les biographies fournies sont relus.
- [ ] Les six statistiques ont leurs périmètres, millésimes et sources lisibles ; les remplacements WTW 2026 (4,95 % et 38 jours) et la précision Gallup sur la moyenne glissante sont acceptés, selon [SOURCES.md](SOURCES.md).
- [ ] Diagnostic présente les cinq étapes, les facteurs de risque, les livrables et les règles de confidentialité.
- [ ] Le rôle du binôme et la limite de ce que le diagnostic promet sont exacts.
- [ ] Le numéro d'enregistrement IPRP **2026.16.004**, demandé par Paul, est correctement attribué à Sara. Aucun enregistrement d'Agnès ni contrôle d'attestation n'est déduit de ce numéro.
- [ ] Les cinq formats de Situations sensibles et leurs limites sont relus ; le téléphone n'est pas présenté comme un service d'urgence et les horaires restent à confirmer.
- [ ] Relire les cadrages des portraits de Sara et d’Agnès sur l’accueil et dans Qui sommes-nous. Paul a fourni le portrait de Sara le 2 novembre et celui d’Agnès le 9 novembre. Les éventuelles photos d’atelier restent à fournir.
- [ ] Les cinq cartes Réflexions renvoient aux articles originaux de Sara sur LinkedIn ; leurs titres, dates et aperçus conviennent. Elles ne sont pas présentées comme des articles intégraux hébergés sur Calas.
- [ ] Les CTA sont faciles à trouver sur mobile ; l'objet Diagnostic est présélectionné au contact.
- [ ] Le formulaire et la confidentialité décrivent les nouveaux champs : organisation, fonction et téléphone facultatifs, accord non précoché, objet Situation sensible. Le délai de réponse annoncé est confirmé avant affichage.
- [ ] L’enroulement de l’extérieur vers le noyau est approuvé au début, au milieu et à la fin ; les cinq rubans se courbent progressivement et le bloc reste fixe, sans parallaxe. Le logo complet retrouve exactement sa géométrie finale et reste correct sur fond clair et sombre, sans JavaScript et en mouvement réduit.

Décision à consigner : date, noms des personnes ayant relu, version du code, fichiers des captures, réserves éventuelles. Une approbation visuelle ne valide pas automatiquement les mentions légales, les comptes externes ou la délivrabilité.

## Informations à obtenir

| Élément | Décision attendue | Comportement avant validation |
| --- | --- | --- |
| Portraits Sara et Agnès | Relecture des cadrages sur ordinateur et téléphone | Chaque fiche Personnes alimente les deux rubriques. Le portrait au jardin fourni par Paul le 9 novembre correspond à Agnès. |
| Biographies et diplômes | Relecture finale des textes et intitulés par Sara et Agnès | Biographies détaillées reprises du nouveau brief ; aucune biographie inventée |
| IPRP Sara | Attestation, autorité/région et validité | Numéro **2026.16.004** et formulation « enregistrée auprès de la DREETS » fournis ; numéro affiché et attribué à Sara en préproduction. La qualification structurée reste `pending`, sans preuve marquée vérifiée |
| Articles | Textes intégraux si une lecture sur Calas est souhaitée ; sixième article et composition de série ; droits des images | Cinq cartes éditables avec auteur, date, aperçu et lien original LinkedIn. Aucun texte intégral ni image LinkedIn importé |
| Conférence | Relecture de la durée approximative fournie | « Environ 1 h 30 » repris du nouveau brief |
| Managers et ateliers | Paramètres encore ouverts : durée globale, participants, prérequis et modalités détaillées | Rythme mensuel et trois phases repris du brief ; champs éditables |
| LinkedIn | URL exacte du profil à afficher dans Contact | Les cinq URL d'articles sont connues ; le lien de profil reste masqué tant qu'il n'est pas confirmé |
| Coordonnées et horaires | Domaine, boîte professionnelle, horaires d'appel et délai de réponse | Téléphone et Gmail fournis conservés. Champs horaires/délai laissés vides ; aucune disponibilité immédiate promise |
| Géographie | Implantation et zone d'intervention | Aucune localisation inventée |
| Identité juridique | Nom légal, forme, SIREN/SIRET si applicable, adresse, directeur de publication | Pas de données factices |
| Données personnelles | Responsable, destinataires, base légale, conservation, contact droits, sous-traitants | Revue nécessaire avant collecte réelle |
| Domaine/hébergement | Achat par Sara du domaine envisagé `calas-conseil.fr`, propriété Calas Conseil, fournisseur, budget et administrateur | Domaine non acheté. Le choix avec tiret remplace la proposition initiale sans tiret ; disponibilité et offre à vérifier avant commande. Aucun achat ni changement DNS |
| CMS propriétaire | Adresse du premier responsable, accès Sara, PostgreSQL et S3 de production | Préproduction Railway vérifiée avec compte de recette ; comptes nominatifs et exploitation définitive à configurer |
| Courriel | Nombre et noms des boîtes, par exemple `sara@calas-conseil.fr` et `agnes@calas-conseil.fr`, accès au fournisseur, transport et test autorisé | Aucune boîte créée ; le besoin n’est plus limité à une seule adresse. Simulation ou boîte locale, aucun email envoyé à Sara. Voir [COURRIEL.md](COURRIEL.md) |

## Revue 2 — Avant production

- [ ] Toutes les pages ont été relues, y compris les métadonnées, les pages légales et les états vides.
- [ ] Aucun texte de travail, faux visuel ou faux témoignage n'apparaît ; les qualifications, diplômes et attributions ont fait l'objet de la confirmation requise avant le lancement définitif.
- [ ] Sara possède les accès administratifs ; les rôles correspondent aux responsabilités retenues.
- [ ] Un paragraphe et une image ont été modifiés dans l’administration ; l’affichage public est vérifié après publication.
- [ ] Un article a été créé, prévisualisé, publié puis vérifié dans la recette isolée ; aucun brouillon n'est accessible au visiteur public.
- [ ] Prévisualisation, cookies, iframe, CORS et isolation du cache sont testés dans les navigateurs retenus.
- [ ] Une sauvegarde des documents **et des médias** a été restaurée dans une base et un bucket isolés ; historique, comptes et médias vérifiés.
- [ ] Le SMTP a passé un test autorisé : destinataire, Reply-To, SPF/DKIM/DMARC, réception et indésirables vérifiés.
- [ ] Le formulaire informe sur les traitements réels ; les journaux et copies éventuelles ont une durée de suppression définie.
- [ ] La sauvegarde quotidienne, sa copie hors site, la rétention et le suivi des échecs sont effectivement raccordés ; les tests locaux de restauration ne remplacent pas cette exploitation.
- [ ] Les mesures d'audience et de demandes retenues ont une finalité et une configuration validées ; aucun bandeau cookies n'est ajouté sans traceur le nécessitant.
- [ ] Navigation clavier, zoom, tailles 360/390/768/1280/1440, mouvement réduit et contenus longs ont été revus.
- [ ] Les parcours de contact, indisponibilité, nouvelle tentative, double clic et limite de débit ont été vérifiés.
- [ ] Les mesures de ressources et Lighthouse correspondent au build livré et à un protocole documenté ; aucune mesure de terrain n'est revendiquée sans trafic.
- [ ] HTTPS, domaine, canonicals, sitemap et robots correspondent à l'environnement cible ; les brouillons restent sans indexation.
- [ ] Les accès, sauvegardes, alertes et responsables de maintenance sont remis.
- [ ] Sara et Agnès ont autorisé la mise en production après relecture ; tout achat est approuvé séparément.

Les travaux locaux réversibles peuvent continuer pendant la relecture. Une case non cochée n'est pas un test réussi ; les raccordements externes ne deviennent vérifiés qu'après exécution réelle.

## Historique — corrections reçues le 26 octobre 2026

Le document fourni par Paul, « correction site web 1.pdf », remplace cinq textes d’accueil : introduction, présentation du diagnostic et trois raisons de travailler ensemble. L’introduction conserve ses deux paragraphes. La carte jointe sert de référence au lettrage en capitales ; le nom reste **Calas Conseil**, avec un seul s, et la signature **La voie de la qualité relationnelle** (correction de « la voir » dans l’annotation du PDF).

La mention IPRP est une formulation fournie pour la relecture, et non une attestation d’habilitation. Les données de qualification, les coordonnées, les biographies et le numéro figurant sur la carte ne sont pas modifiés par cette reprise. La validation finale de l’accueil et de Diagnostic reste à consigner.

Cette réserve décrivait l'intervention du 26 octobre. Elle est remplacée pour les textes, biographies et numéro par les informations explicitement transmises le 1er novembre, sans transformer ces informations en attestation vérifiée.
