# CMS et accès — procédure technique

Sara dispose d’une interface sur le même domaine, à `/admin/`. Son [guide illustré](GUIDE-SARA.md) ne demande aucun terminal pour éditer ou publier. Ce document concerne l’installation et l’exploitation.

## Installation et base

Suivre le README pour PostgreSQL 17, MinIO privé et Mailpit local. `pnpm cms:prepare` crée les secrets dans les `.env` ignorés et conserve toute valeur existante. `pnpm db:migrate --apply` applique les migrations Drizzle versionnées. `pnpm cms:check --services` contrôle les réglages et connexions sans afficher les identifiants.

La commande `pnpm content:seed --dry-run` affiche le plan des17 ressources initiales sans réseau. `--apply` crée uniquement les brouillons manquants. Ajouter `--publish-initial` constitue une publication explicite réservée à la recette. Le seed refuse la production et ne remplace jamais des modifications éditoriales. Aucun seed pendant installation, build ou démarrage.

## Premier administrateur

Sur une base sans aucun compte :

1. Choisir l’adresse et le nom du responsable. Fournir `INIT_ADMIN_EMAIL`, `INIT_ADMIN_NAME`, `INIT_ADMIN_PASSWORD` dans l’environnement privé du processus via un gestionnaire de secrets ou une saisie masquée. Mot de passe unique d’au moins 12 caractères. Ne pas le placer dans un fichier versionné, une commande visible, un chat ou les journaux.
2. Exécuter `pnpm auth:bootstrap`. La commande utilise Better Auth, prend un verrou en base et refuse si un compte existe déjà. Elle ne vérifie pas l’adresse à la place de l’utilisateur et n’accorde pas de dispense MFA.
3. Retirer ces trois variables du processus. En développement, ouvrir Mailpit `http://localhost:18025`, suivre le lien de vérification, puis se connecter avec l’origine exacte indiquée par `BETTER_AUTH_URL`.
4. Activer une application TOTP, vérifier un code et conserver les codes de secours dans un gestionnaire de mots de passe. L’interface ne rend les contenus accessibles qu’après cette étape.
5. Inviter les collaborateurs depuis **Utilisateurs**. Attribuer le rôle éditeur sauf besoin d’administration.

Le compte utilisé dans les tests automatisés est une identité de recette locale, sans mot de passe par défaut. Ses secrets et cookies restent dans `.cache/` ignoré, jamais dans les rapports. Il ne doit pas être transporté en production ; une base de production neuve suit son propre bootstrap.

## Sessions et récupération

Le mot de passe oublié envoie un lien Better Auth valable une heure ; le message affiché reste générique. Le lien est à usage limité et la réinitialisation révoque les sessions antérieures. Elle ne supprime pas le second facteur. Les codes de secours ne servent qu’une fois ; leur régénération depuis Sécurité remplace le jeu précédent.

L’utilisateur peut consulter et révoquer ses sessions. Un administrateur peut suspendre un autre compte, changer ses droits et révoquer ses sessions. Le dernier administrateur actif est protégé. Prévoir au moins deux responsables autorisés et des codes de secours conservés séparément. En cas de perte simultanée du mot de passe, du TOTP et des secours, faire vérifier l’identité et organiser une récupération par l’exploitant selon la procédure Better Auth ; aucun bouton de contournement public ni « mot de passe maître » n’est ajouté.

## Édition et publication

Pages, accueil, personnes, statistiques et paramètres utilisent des champs structurés. Articles : Tiptap, auteur, catégorie, date, couverture, PDF facultatif et droits de téléchargement. L’enregistrement crée un brouillon ; Publier valide puis change atomiquement la version publique. Une autosauvegarde ultérieure ne modifie pas cette version. Les conflits 409 invitent à comparer ou recharger, sans écrasement silencieux.

L’historique montre auteur/date/action ; restaurer crée un nouveau brouillon, sans effacer le passé. La preview nécessite une vraie session autorisée. Le public ne lit ni brouillon ni média privé. Un changement publié est visible sans redéploiement et sans cache partagé à expirer.

Les données riches sont strictement validées côté serveur ; leurs balises ne sont jamais injectées comme HTML arbitraire. Les URLs dangereuses et médias externes non autorisés sont refusés. Voir [MEDIA.md](MEDIA.md) pour le PDF/OCR et le remplacement d’images.

## Recette et maintenance

`pnpm test:cms-local`, `pnpm test:domain`, `pnpm test:integration` et les scénarios authentifiés couvrent les frontières. Les tests de services utilisent des bases isolées ; les scénarios éditoriaux créent des données de recette clairement nommées puis les archivent. Ils n’envoient aucun email externe.

La CI vérifie le build et les parcours principaux sans déployer. Garder les dépendances épinglées ; relire les changements de schéma Better Auth avant mise à jour. Sauvegarder avant migration et tester restauration selon [BACKUP.md](BACKUP.md). Aucun accès Sanity, abonnement CMS ou Studio séparé n’est requis.
