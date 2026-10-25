# Modifier le site avec Sanity — guide pour Sara

Votre travail quotidien se fait dans l'interface graphique Sanity Studio. Vous n'avez besoin ni de Git, ni d'un terminal, ni de Codex pour changer un texte, une image ou un article.

Ce guide décrit le parcours préparé dans les sources du Studio. **Il doit être accompagné d'une première séance sur le vrai projet Calas Conseil** : les comptes, la prévisualisation, la publication, le délai de visibilité et la restauration ne sont pas réputés testés avant cette connexion. L'adresse définitive du Studio vous sera remise après configuration.

## Avant la première utilisation

Sanity est l’administration du site. Le **projet Calas Conseil** rassemble vos contenus ; le **Studio** est l’écran dans lequel vous les modifiez ; le **dataset** est un espace de stockage. Pour commencer, `staging` sera l’espace de test. Un brouillon permet de préparer une modification avant de la publier.

La première étape est de créer votre compte depuis [Sanity Manage](https://www.sanity.io/manage), puis un projet nommé **Calas Conseil** appartenant au cabinet. Le forfait Free peut servir à cette préparation ; ses limites sont décrites sur la [page officielle des tarifs](https://www.sanity.io/pricing). Il n’est pas nécessaire de réinstaller ou de générer un autre site : le Studio est déjà préparé dans ce dépôt.

La personne chargée du raccordement aura besoin du **Project ID** affiché dans ce projet et du nom de l’espace de test. Elle vous accompagnera ensuite pour les accès techniques, à renseigner localement. Votre mot de passe ne doit pas être partagé. La création du compte ne suffit pas encore à activer l’édition : la première connexion et le chargement des textes actuels doivent être terminés.

Le projet doit appartenir à Calas Conseil et vous devez en avoir les accès administratifs. Choisissez avec la personne qui raccorde le site le bon environnement : le dataset de test sert à la prise en main, le dataset de production contient le site publié.

Le forfait gratuit ne propose pas un rôle Editor distinct. Les rôles et le coût éventuel d'un forfait permettant des permissions éditoriales séparées sont à vérifier avant tout abonnement. Un compte Administrator donne plus de droits que la seule rédaction : ne partagez pas vos identifiants.

## Changer une page

1. Connectez-vous au Studio et ouvrez **Accueil** ou la page concernée dans la navigation.
2. Modifiez le champ voulu : surtitre, titre principal, introduction, section ou lien de contact. Les libellés et aides sont en français.
3. Conservez l'adresse de la page. Par exemple, `diagnostic-rps` correspond à la page Diagnostic ; la changer sans accompagnement casserait les liens existants.
4. Regardez les messages de validation. Ils signalent notamment les champs obligatoires, les textes trop longs et les liens incorrects.
5. Ouvrez l'outil de prévisualisation du Studio et vérifiez la page sur ordinateur puis mobile.
6. Gardez le document en brouillon pour une relecture. Publiez seulement le contenu approuvé dans l'environnement choisi.

Le site garde sa composition, ses couleurs et ses animations. Les formats de section autorisés sont encadrés : texte, étapes, points clés, idées complémentaires ou précision. Les champs éditoriaux ne donnent pas accès à un outil de mise en page illimité.

Les groupes éditoriaux de l’accueil permettent aussi de modifier les petites phrases autour du logo, les repères de section, les notes et les liens. Dans Diagnostic, la présentation de la méthode et des questions fréquentes se choisit par leur libellé ; les clés techniques n’ont pas à être modifiées. Les textes de la rubrique Réflexions, même lorsqu’aucun article n’est publié, s’éditent dans sa page.

Pour les boutons de contact, les destinations prévues sont :

| Offre | Destination |
| --- | --- |
| Diagnostic | `/contact/?objet=diagnostic` |
| Équipes | `/contact/?objet=equipes` |
| Managers | `/contact/?objet=managers` |
| Contact général | `/contact/` |

## Remplacer un portrait ou une image

Ouvrez la personne ou le document concerné, sélectionnez le champ image et choisissez un fichier authentique dont vous détenez les droits. Ajustez le cadrage et le point d'intérêt si nécessaire. Renseignez la description de l'image : elle permet aux personnes qui ne la voient pas d'en comprendre le contenu utile.

Vérifiez le rendu mobile, le recadrage du visage et la cohérence avec l'autre portrait avant publication. N'utilisez ni portrait généré, ni justificatif IPRP comme image publique. Les attestations privées n'ont pas leur place dans le CMS éditorial.

## Créer un article

### À partir d’un PDF

1. Ouvrez **Importer un PDF**, dans les outils du Studio, puis choisissez votre document.
2. L’outil lit le texte et reconnaît les caractères des pages scannées. Attendez la fin de l’analyse ; vous pouvez l’annuler. Le document reste sur votre ordinateur à cette étape.
3. Vérifiez l’aperçu, ajustez le titre et le résumé proposés. Le résumé est un extrait du début du document, pas un résumé rédigé automatiquement. Si une page mêle texte et zones scannées et que des passages manquent, utilisez **Refaire avec reconnaissance complète** pour traiter toutes les pages.
4. Cliquez sur **Créer le brouillon**. Le PDF est alors envoyé à Sanity et joint à un nouvel article ; les articles existants ne sont pas remplacés.
5. Ouvrez le brouillon, relisez le texte, corrigez la mise en forme et renseignez l’auteure réelle ainsi que la date. Cochez la relecture de l’import une fois le texte vérifié.
6. Prévisualisez et publiez quand le contenu est prêt. La page de l’article proposera **Télécharger le PDF original**.

La limite initiale est de **20 Mo, 40 pages et 200 000 caractères** par import. La reconnaissance des scans peut prendre plus de temps et faire des erreurs, notamment sur les noms, chiffres, colonnes et tableaux. L’article reprend du texte modifiable ; il ne reproduit pas automatiquement les illustrations et la mise en page du PDF. Le fichier original conserve cette présentation.

**Choisissez seulement des PDF destinés à la diffusion.** Après ajout à Sanity, le fichier peut être ouvert par toute personne disposant de son lien, même si l’article est encore en brouillon. Le brouillon protège le texte éditorial, pas le fichier joint sur le CDN.

### En écrivant directement dans le Studio

1. Ouvrez **Articles** et créez un document.
2. Renseignez le titre, l'adresse lisible, le résumé et la date approuvée.
3. Sélectionnez l'auteure réelle dans les personnes disponibles et, si utile, une catégorie.
4. Écrivez le texte dans le champ Article. Utilisez les titres de section et sous-titres pour organiser le contenu ; le titre principal est déjà fourni par le champ Titre.
5. Ajoutez éventuellement une image avec sa description et vérifiez les liens.
6. Prévisualisez puis faites relire le brouillon. Publiez seulement le texte final approuvé.

Un article de démonstration ne doit pas être publié sous votre signature. Tant qu'aucun article final n'est approuvé, la rubrique Réflexions affiche son état vide prévu. Ne créez pas de date, témoignage, client ou résultat pour remplir la page.

## Mettre à jour un chiffre

Les chiffres sont des documents distincts réutilisés par l'accueil. Chaque chiffre comporte sa valeur, ce qu'il mesure, sa source, le lien primaire, le millésime et une note de périmètre. Vérifiez la source avant de cocher la vérification.

Conservez les années demandées tant qu'une actualisation n'a pas été approuvée. Ne confondez pas stress de la veille et stress causé par le travail, signe de détresse et diagnostic médical, arrêts longs et tous les arrêts, ou coût global de l'absentéisme et coût des seuls RPS. Le document `SOURCES.md` explique les formulations retenues.

Le champ de vérification protège la cohérence d'affichage, pas la confidentialité. Une information non validée doit rester un **vrai brouillon**, et non être publiée en comptant sur un interrupteur pour la cacher.

## Coordonnées et qualification

Les paramètres communs rassemblent téléphone, courriel, signature, pied de page et LinkedIn. Laissez LinkedIn vide jusqu'à validation de l'adresse exacte. La marque reste « Calas Conseil », avec un seul s.

Le statut IPRP est centralisé et masqué lorsqu'il n'est pas vérifié. La formulation proposée est « IPRP enregistrée auprès de la DREETS ». Ne passez le statut à « Justificatif contrôlé » qu'après vérification réelle de l'attestation, du libellé et des éventuels numéro, région et validité. Le document privé reste conservé séparément.

## Brouillons, publication et retour arrière

La prévisualisation vous permet de voir les brouillons grâce à une session réservée aux personnes autorisées. Une simple adresse de page publique ne donne pas accès à ces contenus. Fermez la prévisualisation ou quittez son mode pour vérifier la version publiée comme un visiteur.

Après publication, la page est rendue depuis le CMS. Le projet prévoit un cache partagé de 30 secondes ; le délai réel doit être mesuré sur l'hébergement retenu. Si votre modification reste absente au-delà du délai constaté pendant la recette, contactez la personne chargée de la maintenance. Ne republiez pas de multiples copies du document.

Pour annuler une modification encore en brouillon, utilisez les actions du document après avoir vérifié quelle version est publiée. Pour une modification déjà publiée, demandez une restauration depuis l'historique disponible ou une sauvegarde. L'existence et la durée de cet historique doivent être contrôlées avec le forfait réel. Toute restauration importante est d'abord testée dans un environnement distinct.

## Recette de prise en main à faire ensemble

- Modifier un paragraphe de l'accueil, le prévisualiser puis le publier dans l'environnement de test.
- Remplacer une image, contrôler son texte alternatif et ses cadrages.
- Créer un article de test clairement identifié, vérifier son brouillon, publier puis retirer ce test.
- Vérifier dans une fenêtre sans session de preview que les brouillons restent invisibles.
- Mesurer l'apparition d'une publication après expiration du cache.
- Essayer la restauration disponible sans toucher au contenu de production.

Ne placez jamais dans le Studio les demandes reçues via le formulaire, des données médicales, des renseignements privés concernant un tiers, des mots de passe ou des attestations. Le CMS sert aux contenus destinés au site.
