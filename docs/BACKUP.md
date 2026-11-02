# Sauvegarde et restauration du CMS

Cette procédure concerne le développeur ou l’exploitant. Sara utilise l’historique dans l’administration pour restaurer un texte ; elle n’a pas à manipuler une base de données ou une clé de chiffrement.

## Ce qui est sauvegardé

`pnpm content:export` crée une archive `.calas-backup` chiffrée avec AES-256-GCM. Elle comprend le dump PostgreSQL complet : contenus, brouillons, versions immuables, publications, références médias, audit, comptes Better Auth, sessions et configuration éditoriale. Elle comprend aussi tous les objets du bucket privé, dont originaux, variantes et anciennes clés conservées après remplacement. Chaque fichier possède une empreinte SHA-256. Un manifeste indique la date UTC, la version PostgreSQL, la révision Git disponible et les empreintes des migrations.

Le code demeure versionné dans Git ; le manifeste indique la révision à récupérer. Les fichiers `.env`, mots de passe SMTP/S3/PostgreSQL, `BETTER_AUTH_SECRET` et clé de sauvegarde ne sont jamais ajoutés à l’archive. Les tables d’authentification, elles, contiennent des données privées et sont donc couvertes par le chiffrement de toute l’archive.

Le dump utilise un instantané PostgreSQL exporté. Un verrou partagé sur les métadonnées des médias empêche leur suppression ou remplacement pendant la capture du dump et des objets. La procédure échoue si un média connu de cet instantané manque dans le bucket. Un échec ne produit pas d’archive annoncée comme terminée. Les contenus et diagnostics SQL ne sont pas écrits dans les journaux.

Le format actuel est borné à 5 Gio par archive, 2 Gio de dump et 100 000 objets, adaptés à cette première exploitation. Une limite dépassée interrompt l’opération sans annoncer de sauvegarde valide. Faire évoluer le format et sa recette avant d’approcher ces volumes. Le fonctionnement du dump et de sa restauration suit les clients officiels [pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html) et [pg_restore 17](https://www.postgresql.org/docs/17/app-pgrestore.html).

## Préparer l’exploitation

1. Conserver `BACKUP_ENCRYPTION_KEY`, clé aléatoire de **32 octets en base64**, dans un gestionnaire de secrets distinct des archives. Ne pas la transmettre dans une conversation, Git ou une commande visible. La préparation locale la crée dans `.env` si nécessaire.
2. Conserver séparément `BETTER_AUTH_SECRET`. Cette clé protège notamment les secrets TOTP enregistrés dans la base. Restaurer le même secret lors d’un transfert normal ; sa perte nécessite une récupération d’accès contrôlée. Une rotation après incident doit être préparée avec révocation des sessions et réinscription MFA si nécessaire.
3. Installer les clients PostgreSQL de la même version majeure que le serveur, actuellement **17**, ou utiliser le mode Docker local décrit ci-dessous. `POSTGRES_BIN` peut désigner leur dossier. Les identifiants sont transmis aux clients natifs par les variables `PG*`, jamais en argument de commande.
4. Le dossier `backups/` doit être privé, exclu de Git et disposer d’assez d’espace pour les données temporaires. La procédure retire ses fichiers temporaires à la fin. Un arrêt brutal peut laisser des fichiers en clair dans `backups/.work/` : nettoyer uniquement les dossiers abandonnés après avoir confirmé qu’aucune sauvegarde/restauration ne tourne. En hébergement, utiliser un volume privé et chiffré ou un poste d’exploitation maîtrisé.

Le mode Docker de développement emploie `BACKUP_POSTGRES_CONTAINER=calas-development-postgres-1`. Il vérifie que le port publié du conteneur correspond à `DATABASE_URL`, puis exécute `pg_dump`/`pg_restore` dans ce conteneur, sans transmettre de mot de passe en argument. Retirer cette variable lorsqu’on utilise des clients natifs pour une base distante.

## Exporter

Depuis la racine du dépôt, après configuration de PostgreSQL et S3 :

```powershell
pnpm content:export
# ou choisir un nouveau nom, toujours dans le dossier privé :
pnpm content:export backups/calas-avant-migration.calas-backup
```

La commande refuse d’écraser un fichier existant. Elle n’initialise ni ne publie de contenu. Une archive terminée doit être copiée, toujours chiffrée, dans un stockage privé indépendant de l’application et de son fournisseur principal. Garder la clé ailleurs. Aucun stockage distant de sauvegarde, coût ou planning automatique n’a été activé par cette livraison.

Politique de rétention proposée à valider par l’exploitant : trente sauvegardes quotidiennes, douze hebdomadaires et douze mensuelles, plus une archive avant migration ou intervention sensible. Adapter cette conservation aux données privées et à la politique du cabinet. Supprimer les copies arrivées à échéance dans tous leurs emplacements.

## Restaurer sans écraser un site

La commande de restauration est volontairement réservée à un environnement `development`, `test` ou `staging`, dans une base dont le nom contient `test`, `restore` ou `staging`. La base et le bucket de destination doivent être **entièrement vides**. Les créer explicitement avec les outils de l’hébergeur, puis pointer les variables de l’environnement de restauration vers eux. Ne pas exécuter de migration ni de seed sur cette destination avant l’import : le dump contient le schéma et le journal Drizzle.

```powershell
# DATABASE_URL et S3_BUCKET désignent maintenant les destinations isolées.
# BACKUP_ENCRYPTION_KEY est la clé de cette archive.
pnpm content:import backups/calas-avant-migration.calas-backup --confirm-empty
```

Avant toute écriture, l’archive est entièrement authentifiée, ses enregistrements validés et leurs empreintes vérifiées. Les chemins locaux d’extraction sont générés par le programme ; les clés S3 archivées sont contrôlées. Le programme refuse une archive altérée et une destination non vide. Les médias sont copiés puis relus pour contrôler leurs octets. `pg_restore` s’exécute dans une transaction unique ; si une restauration échoue, les seuls objets téléversés par cette tentative sont retirés. En cas d’indisponibilité du stockage pendant cette compensation, inspecter le bucket isolé avant de réessayer : le prochain import refusera les objets restants.

Après import :

- Démarrer la même révision applicative que celle indiquée par le manifeste, avec les secrets appropriés ; appliquer ensuite les nouvelles migrations seulement après sauvegarde et validation de compatibilité.
- Vérifier connexion et MFA, droits, pages, dernier publié, brouillon plus récent, historique, images et PDF privés/publics.
- Vérifier les empreintes du manifeste et le nombre d’objets. Tester une modification puis publication dans la recette.
- Préparer une bascule contrôlée vers ces ressources. La commande ne change ni domaine, ni environnement Railway, ni base de production.

Un changement de serveur suit la même procédure. Une migration applicative doit rester compatible avec l’ancien schéma pendant une bascule progressive. En cas d’échec, revenir au code précédent si le schéma demeure compatible ; sinon restaurer l’archive dans une nouvelle destination, vérifier, puis faire autoriser la bascule. Ne pas exécuter de suppression/recréation automatique de la base de production.

## Vérification réellement exécutée

Le 25 octobre 2026, `tests/content-backup.test.ts` a réussi **six contrôles** : authentification et chiffrement, dump cohérent PostgreSQL 17 et inventaire S3, rejet d’une archive altérée avant écriture, restauration réelle des versions/brouillons/publications/comptes et des octets d’un PDF, puis refus d’une seconde restauration sur la destination non vide. Le test a utilisé deux bases et deux buckets MinIO temporaires distincts des ressources locales principales ; ces ressources de test ont été supprimées à la fin.

```powershell
$env:RUN_BACKUP_INTEGRATION='1'
$env:BACKUP_POSTGRES_CONTAINER='calas-development-postgres-1'
pnpm --filter @calas/web exec tsx --test ../../tests/content-backup.test.ts
```

Cette recette valide les adaptateurs PostgreSQL et S3 compatibles localement. Elle ne vaut pas une restauration Railway ni un contrôle d’un stockage de sauvegarde externe. Refaire la recette après raccordement de l’hébergement, puis périodiquement et après tout changement de version majeure de PostgreSQL, de stockage ou de format d’archive.
