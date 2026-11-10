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

### Reprendre une archive depuis un autre poste

L’opérateur a besoin de l’archive chiffrée, de sa clé `BACKUP_ENCRYPTION_KEY`, du dépôt à la révision indiquée dans le manifeste et de deux destinations de restauration vides (PostgreSQL et stockage S3). Pour remettre les comptes en service, reprendre également les secrets d’application selon la procédure de déploiement. Conserver la clé de récupération dans un coffre auquel le cabinet ou son opérateur peut accéder même si l’ordinateur habituel est indisponible.

Télécharger l’archive depuis le stockage privé dans le dossier local `backups/` avec une session d’exploitation autorisée, puis suivre la procédure « Restaurer » ci-dessous. Le contrôle d’intégrité porte sur le fichier téléchargé. Valider les documents, les comptes et les empreintes des médias en environnement isolé avant de basculer le site.

Depuis un poste neuf, ouvrir le projet **Calas**, environnement **production**, avec le compte opérateur Railway. Les variables de `Calas-Backup` donnent le bucket d’archives (`BACKUP_S3_BUCKET`) et sa clé de déchiffrement (`BACKUP_ENCRYPTION_KEY`). Dans ce bucket, `status/latest.json` indique le chemin `daily/…` et l’empreinte SHA-256 de la dernière archive vérifiée. Le secret d’authentification `BETTER_AUTH_SECRET` se trouve dans les variables du service `Calas-Web-Test`. Transférer ces secrets par un coffre privé. La récupération par ce chemin nécessite l’accès au projet Railway.

### Export manuel

Depuis la racine du dépôt, après configuration de PostgreSQL et S3 :

```powershell
pnpm content:export
# ou choisir un nouveau nom, toujours dans le dossier privé :
pnpm content:export backups/calas-avant-migration.calas-backup
```

La commande refuse d’écraser un fichier existant. Elle n’initialise ni ne publie de contenu. Une archive terminée doit être copiée, toujours chiffrée, dans un stockage privé indépendant de l’application et de son fournisseur principal. Garder la clé de récupération séparément des archives.

Politique de rétention proposée à valider par l’exploitant : trente sauvegardes quotidiennes, douze hebdomadaires et douze mensuelles, plus une archive avant migration ou intervention sensible. Adapter cette conservation aux données privées et à la politique du cabinet. Supprimer les copies arrivées à échéance dans tous leurs emplacements.

## Sauvegarde hébergée et alertes

`Calas-Backup` est un job Railway privé. Sa planification quotidienne est `0 6 * * *`, soit **7 h en hiver, 8 h en été** en France métropolitaine. Le processus exporte PostgreSQL et les objets du stockage des médias, chiffre l’archive et la dépose dans un deuxième bucket privé. Il relit ensuite l’objet distant, vérifie les empreintes et l’intégrité du dump. La rotation intervient après cette vérification et conserve les 30 dernières dates ainsi que les dernières captures de 12 semaines et de 12 mois. Une nouvelle exécution le même jour UTC vérifie et réutilise une copie du jour déjà valide.

Le bucket `calas-backup-archives` contient les objets `daily/calas-daily-AAAA-MM-JJ.calas-backup` et le dernier état vérifié dans `status/latest.json`. Lors d’un déploiement du site, si `BACKUP_SOURCE_REVISION` est renseignée sur le job, la mettre à jour avec le SHA du service web. En son absence, retrouver le commit dans l’historique du service web à l’heure de la capture. Le contrôle quotidien authentifie les octets de l’archive et vérifie la signature du dump. Pour vérifier une reprise complète, suivre la procédure « Restaurer » dans une base et un stockage vides.

Un stockage privé distinct des archives reçoit les signaux techniques `backup/success.json` et `backup/failure.json`. `Calas-Monitor` consulte ces signaux toutes les cinq minutes depuis une autre région Railway. Il contrôle aussi le contenu de l’accueil HTTPS et la réponse de `/api/ready/`, qui vérifie PostgreSQL et le stockage des médias. Deux contrôles consécutifs en échec ouvrent un incident pour le site. Un échec explicite de sauvegarde est signalé au passage suivant. Si la confirmation de l’archive du jour manque à **07 h UTC** (8 h en hiver, 9 h en été à Paris), la sonde peut ainsi signaler un job qui n’a pas démarré.

La sonde utilise la messagerie OVH et le destinataire opérateur `MONITOR_ALERT_EMAIL`. Un rétablissement déclenche une notification. Son volume persistant mémorise les incidents et les messages acceptés par le serveur SMTP. En cas de refus ou de coupure SMTP, le message reste en attente pour le prochain passage. En cas de perte de la réponse SMTP après envoi, une nouvelle remise reste possible.

Si le site est signalé en panne, ouvrir le domaine puis consulter l’état du service web, de PostgreSQL et du stockage sur Railway. En cas d’alerte de sauvegarde, comparer la dernière exécution de `Calas-Backup` avec le marqueur et l’archive distante, puis relancer le job après correction. La sonde et les archives dépendent du même fournisseur que le site. Une indisponibilité de tout Railway peut aussi empêcher l’envoi des alertes. Le transfert vers OVH devra prévoir une nouvelle destination de sauvegarde et un nouveau point d’exécution pour la sonde.

Le 10 novembre 2026 (heure de Paris), la première exécution sur Railway a produit une archive chiffrée de 7 172 260 octets. L’accès anonyme a renvoyé HTTP 403. Une restauration de l’archive téléchargée dans un PostgreSQL et un stockage isolés a retrouvé 33 documents, dont 31 publiés, 128 révisions, six comptes dont trois actifs, et 14 médias. Les 53 objets ont été relus et leurs empreintes et références vérifiées.

L’opérateur a reçu l’e-mail de test via OVH. Au passage automatique de 00 h 30 (Paris), la sonde en Virginie a confirmé l’accueil, la disponibilité des services et la sauvegarde. Son volume a conservé l’accusé d’acceptation SMTP du test, avec zéro nouvel envoi.

<a id="sauvegarde-quotidienne-hors-railway"></a>

## Copie supplémentaire sur Windows

La tâche historique peut continuer à produire une copie hors du compte Railway lorsque le poste est disponible. L’archive hébergée et son contrôle par e-mail fonctionnent indépendamment de cette copie supplémentaire. Garder au moins une clé de récupération et une copie valide hors du projet Railway.

Le lanceur Windows fournit à `scripts/daily-backup.ts` un tunnel privé vers le PostgreSQL du projet Calas. Il transmet les identifiants de lecture S3, la clé `BACKUP_ENCRYPTION_KEY` utilisée pour la restauration, le nom du bucket attendu, les paramètres SSH et le chemin absolu `CALAS_BACKUP_DIR`. Ce répertoire dédié, avec droits restreints à l’opérateur, se trouve hors du code. Son sous-dossier `.work` peut contenir un dump et des octets en clair pendant l’écriture et la relecture ; il requiert les mêmes protections. Le PC, son disque et la connexion réseau doivent être disponibles pour exécuter la tâche.

Chaque réussite produit `calas-daily-AAAA-MM-JJ.calas-backup` à la date de Paris. Avant de publier l’archive, le programme relit son contenu chiffré, vérifie son authenticité AES-GCM, la signature du format PostgreSQL et les empreintes de tous les fichiers. Un deuxième lancement le même jour contrôle de nouveau la copie existante. Une erreur ne supprime aucune copie de la veille. Un verrou PostgreSQL sérialise les tentatives concurrentes.

Après validation, la rotation conserve les 30 dernières dates sauvegardées, la dernière copie de chacune des 12 dernières semaines représentées et celle de chacun des 12 derniers mois représentés. Une même archive peut remplir plusieurs de ces fonctions. Les archives de migration et celles dont le nom ne suit pas le format quotidien restent indépendantes. Pour restaurer, copier l’archive chiffrée sélectionnée dans le dossier privé `backups/`, fournir sa clé et utiliser la procédure de restauration isolée ci-dessous.

Après un arrêt brutal, l’exécution suivante nettoie sous verrou ses propres fichiers temporaires identifiables. Elle laisse en place les exports manuels, les liens et les dossiers contenant un fichier inattendu. Le résultat du dernier essai est écrit dans `latest.json` (`running`, `ok` ou `failed`). Il contient des dates, une étape en cas d’échec et, en cas de succès, le nom, la taille, l’empreinte et le nombre d’objets. Un état bloqué sur `running` ou une date trop ancienne exige un contrôle de l’ordinateur et de sa tâche. L’exécuteur ne contacte aucun destinataire d’alerte.

### Installer ou mettre à jour le programme Windows

Sur le poste de Paul, depuis un checkout validé avec les dépendances verrouillées, exécuter `node scripts/backup-windows/build.mjs`. La commande affiche le répertoire du programme autonome. L’installateur en vérifie les empreintes et en installe une version privée indépendante des modifications du dépôt. Il s’utilise dans Windows PowerShell sous le compte qui détient la session CLI Railway et la clé SSH.

```powershell
.\scripts\backup-windows\install.ps1 -Bundle $dossierDuProgramme -RegisterTask
```

Pour une première installation ou un changement d’identifiants, fournir au processus les paramètres privés de la section précédente, `CALAS_BACKUP_PRIVATE_DATABASE_URL` (DSN interne), `CALAS_RAILWAY_BIN`, `CALAS_BACKUP_SSH_BIN`, `CALAS_BACKUP_SSH_KEY` et `NODE_BIN` (chemins absolus), puis ajouter `-Configure`. L’installateur protège ces valeurs avec Windows DPAPI pour l’utilisateur courant. Conserver séparément une copie de récupération de la clé d’archive : DPAPI est lié à la session Windows de ce poste.

La tâche **Calas Conseil - sauvegarde quotidienne** est prévue à **09 h 00**, heure locale du poste réglé sur Paris, et à l’ouverture de la session de Paul. Elle relit la copie si la journée est déjà couverte et retente en cas d’échec. Un PC éteint ne produit pas d’archive ; la tâche peut reprendre à la prochaine ouverture de session avec Internet. Le fichier `%LOCALAPPDATA%\CalasConseil\archives\latest.json` donne l’état du dernier passage. Les notifications externes sont à convenir séparément.

Le 9 novembre 2026, la première archive quotidienne (6 159 712 octets) a été restaurée dans PostgreSQL et MinIO isolés. Elle contenait 32 documents, 123 révisions, 6 comptes dont les 3 comptes nominatifs actifs, 12 médias et 48 objets. Les 48 empreintes et les références de publication ont été vérifiées. Le lancement de la tâche par le Planificateur Windows sous le compte de Paul a ensuite relu cette archive avec succès.

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
