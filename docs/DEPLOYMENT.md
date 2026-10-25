# Déploiement, sauvegarde et restauration

La livraison vise d'abord le développement et la préproduction. Aucun compte d'hébergement, domaine ou abonnement n'a été créé par cette procédure. La publication dépend de la revue de `VALIDATION.md`. Les identifiants et la propriété administrative doivent appartenir à Calas Conseil.

## Application Node autonome

Le dépôt contient `apps/web` (Astro SSR) et `apps/studio` (Sanity Studio séparé). La configuration Astro utilise `@astrojs/node` en mode `standalone`. Le serveur produit les pages éditables à la demande et sert aussi les assets. Le Studio n'est pas intégré au parcours du visiteur.

Utiliser la version de Node déclarée dans `package.json`, ainsi que la version de pnpm du champ `packageManager`. Installer à partir du lockfile :

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm test:unit
pnpm build:studio
```

La recette navigateur se lance avec `pnpm test`. Les tests doivent utiliser un transport simulé ou une boîte locale, jamais l'adresse réelle de Sara sans autorisation. Ne pas interpréter un build réussi comme une preuve du fonctionnement CMS, de la preview ou de la réception d'un email.

Pour lancer le serveur compilé depuis la racine, avec les variables injectées par l'hébergeur :

```sh
pnpm start
```

L'entrée Node correspond à `apps/web/dist/server/entry.mjs`. Le répertoire de travail du script `start` est `apps/web`. Pour un lancement direct depuis ce dossier :

```sh
node ./dist/server/entry.mjs
```

Le runtime lit `HOST` et `PORT`. Utiliser `HOST=0.0.0.0` sur l'hébergeur et son port imposé ; localement, `127.0.0.1` suffit. Placer HTTPS devant le serveur Node, au niveau du proxy ou de la plateforme. Conserver les dossiers `dist/server` et `dist/client` ainsi que les dépendances de runtime requises. [Documentation officielle de l'adaptateur Node](https://docs.astro.build/en/guides/integrations-guide/node/).

## Variables et séparation des environnements

Les fichiers `.env.example` sont les inventaires de référence ; les copier localement en `.env`, puis injecter les valeurs réelles dans le gestionnaire de secrets de l'hébergement. Ne jamais committer les `.env`, jetons, exports contenant des brouillons ou justificatifs privés.

| Environnement | Contenu | Courriel | Indexation |
| --- | --- | --- | --- |
| Développement local | `CONTENT_MODE=demo` explicitement, ou dataset de test autorisé | Simulation / boîte locale | Désactivée |
| Préproduction privée | Dataset de test distinct, comptes Sanity autorisés | Destination de test explicite | Désactivée et accès privé |
| Production approuvée | `CONTENT_MODE=sanity`, contenus relus publiés | SMTP authentifié, expéditeur autorisé, destinataire validé | Activée seulement après revue |

Configurer `SITE_URL` avec l'origine exacte de chaque environnement et `SITE_ENV` avec `development`, `staging` ou `production`. Pour le frontend, `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET` et `PUBLIC_SANITY_STUDIO_URL` identifient le projet, le dataset et le Studio ; ces identifiants ne sont pas secrets. `SANITY_API_READ_TOKEN` et `PREVIEW_SESSION_SECRET` restent strictement côté serveur. La clé de signature doit être aléatoire et contenir au moins 32 caractères. Le Studio utilise ses variables `SANITY_STUDIO_*`, dont l'URL de preview. Aucun secret de lecture privée ou d'écriture ne doit avoir un préfixe `PUBLIC_` ni être placé dans une variable destinée au bundle du Studio.

Le déploiement du frontend ne lance **aucun import ou seed**. Une panne CMS doit retourner l'état maîtrisé prévu par l'application ; elle ne doit pas basculer vers les données de démonstration.

L'initialisation peut être inspectée sans appel réseau :

```sh
pnpm content:seed --dry-run
```

Pour une écriture réellement autorisée, utiliser un dataset nommé `staging`, `development` ou `test` (ou l'un de ces préfixes suivi d'un suffixe avec tiret), fournir `SANITY_WRITE_TOKEN` côté serveur et activer `CALAS_ALLOW_CONTENT_WRITE=yes`. Le seed crée uniquement les documents absents comme **brouillons**, sans article inventé ; un document déjà publié ou déjà en brouillon n'est pas remplacé. Le lancement normal est `pnpm content:seed`. Faire relire puis publier manuellement les contenus nécessaires dans le dataset de test. Retirer l'opt-in et le jeton d'écriture de l'environnement du serveur web après l'opération.

## Sanity et prévisualisation

La procédure complète, les rôles réels, les commandes de contenu et la recette sont dans `CMS.md`. Héberger le Studio sur un sous-domaine Sanity appartenant au projet Calas Conseil, une fois le compte créé et les accès validés. Les brouillons doivent rester de vrais brouillons Sanity.

Renseigner les seules origines requises dans CORS : Studio déployé, frontend de préproduction et origines locales nécessaires à la recette. N'autoriser les credentials que pour les origines exactes qui en ont besoin, jamais avec un wildcard. Configurer l'autorisation d'iframe de la preview pour le Studio exact ; vérifier les restrictions de cookies dans les navigateurs testés.

Les routes `/api/preview/enable/` et `/api/preview/disable/` ouvrent ou ferment la preview. Vérifier la session signée d'une durée d'une heure, son expiration et le refus d'un cookie arbitraire. Les réponses de preview sont privées, sans cache et sans indexation ; les routes publiques utilisent `published`. Le token de lecture des brouillons reste côté serveur. Les messages du formulaire, les secrets et les attestations privées ne doivent jamais être stockés dans le dataset éditorial public.

Le contenu public connecté est actuellement servi avec `public, max-age=0, s-maxage=30, must-revalidate`, sans cache CDN Sanity supplémentaire. Le budget de visibilité prévu est de 30 secondes de cache partagé, auquel s'ajoutent le traitement de publication et le transit. Un hébergement sans cache partagé refait la lecture à chaque requête. Ce n'est pas une invalidation automatique après publication. Mesurer après raccordement en publiant une modification dans le dataset de test, en interrogeant le frontend sans cookies et en notant l'heure de première apparition. Répéter depuis les chemins de cache réellement déployés. Un proxy qui modifie les en-têtes impose de refaire cette mesure. Aucune mesure CMS réelle n'est revendiquée en l'absence de projet connecté.

## Courriel et données de contact

Choisir le transport authentifié et valider son traitement des données. Le réglage `MAIL_TRANSPORT=simulation` accepte puis détruit la demande en développement, sans l'envoyer ni la conserver. `MAIL_TRANSPORT=smtp` utilise `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` et `SMTP_TO`. Le mode `unavailable` est réservé au test de panne. Configurer une adresse `SMTP_FROM` autorisée par ce transport ; placer l'adresse validée du visiteur en `Reply-To`. Ne jamais usurper l'adresse du visiteur comme expéditeur.

Publier les enregistrements SPF, DKIM et DMARC demandés par le fournisseur pour le domaine d'envoi choisi, puis effectuer un test autorisé de réception, réponse et classement en indésirables. Documenter le destinataire réel, les éventuelles copies, la rétention chez le transport et dans la boîte destinataire, ainsi que leur suppression. Ne pas conserver ni journaliser le corps des messages dans les logs applicatifs.

La simulation de développement valide le parcours applicatif mais ne démontre pas la délivrabilité. En préproduction, afficher clairement la destination de test aux personnes qui font la recette. Hors production, `SMTP_TO` doit cibler un domaine `example.test` ou `.invalid` ; `ALLOW_REAL_EMAIL=true` ne doit être utilisé qu'après autorisation explicite d'un test réel. Désactiver toute injection volontaire de panne avant la production. La limite `CONTACT_RATE_LIMIT=5` correspond à cinq demandes par fenêtre de quinze minutes. Vérifier la limitation de débit en tenant compte de l'IP fournie par le proxy de confiance ; une limitation en mémoire concerne une seule instance et se réinitialise au redémarrage. Avant plusieurs instances, utiliser une protection de débit mutualisée en amont.

## Option Railway

Cette option ne présume aucun projet existant. Après accord sur le service et son budget, utiliser la racine du dépôt comme répertoire de construction, la version Node déclarée, l'installation verrouillée, puis `pnpm build`. La commande de démarrage est `pnpm start`. Injecter `HOST=0.0.0.0` et écouter le `PORT` fourni par Railway. Configurer le healthcheck `/api/health/` et vérifier son HTTP 200 avant l'ouverture au public. Cette réponse de santé indique que le processus répond ; elle ne prouve pas à elle seule la disponibilité Sanity ou la réception des emails.

Un healthcheck Railway valide un déploiement ; il ne constitue pas une surveillance continue après démarrage. Si une liste d'hôtes autorisés est ajoutée, tenir compte de `healthcheck.railway.app`. [Déploiement Astro sur Railway](https://docs.railway.com/guides/astro) et [healthchecks Railway](https://docs.railway.com/deployments/healthchecks).

Ne connecter le domaine définitif et ne lever la désindexation qu'après la validation. Vérifier le certificat HTTPS, les redirections, les canonicals, le sitemap, les pages 404 et les en-têtes sur l'URL réellement déployée.

## Sauvegardes

1. Conserver le code, le lockfile, les schémas et les assets source dans un dépôt sauvegardé contrôlé par Calas Conseil. Marquer chaque version livrée ; ne jamais inclure de secrets.
2. Exporter les documents Sanity **et les médias** avec la procédure de `CMS.md`, avant toute opération de restauration ou migration, puis selon la fréquence convenue.
3. Conserver les exports chiffrés avec accès limité. Ils peuvent contenir des brouillons ; ne pas les placer dans `public/`, le dépôt ou une URL publique.
4. Tenir un inventaire séparé des secrets à recréer : SMTP, jeton lecture preview, signature de session et jetons d'administration temporaires. Une sauvegarde du code ne restaure pas ces secrets.
5. Noter la date, le dataset, la version de schéma, le nombre de documents/assets et le résultat de chaque sauvegarde. Définir la conservation et la suppression avec le cabinet.

Les scripts chargent les variables de processus et les fichiers `.env` locaux. Pour l'export, fournir `SANITY_EXPORT_TOKEN` ou un `SANITY_API_READ_TOKEN` autorisé, ainsi que les identifiants de projet/dataset :

```sh
pnpm content:export backups/contenu-2026-10-25.tar.gz
```

Le script utilise le CLI officiel, avec les médias inclus par défaut, et refuse d'écraser une archive existante. Adapter le nom à la date réelle de l'opération. Pour la restauration, sélectionner un dataset de test **vide**, fournir `SANITY_WRITE_TOKEN` et l'opt-in d'écriture :

```sh
pnpm content:import backups/contenu-2026-10-25.tar.gz
```

Le script refuse un dataset contenant déjà des documents et n'utilise pas l'option `--replace`. Il refuse la production. Le jeton est transmis au CLI dans l'environnement de son processus, pas dans les arguments de commande. Les commandes ci-dessus sont livrées mais l'export/restauration réel doit être exécuté avec le projet autorisé avant d'être déclaré vérifié.

## Restauration et retour arrière

Restaurer d'abord dans un **dataset de test distinct**, jamais directement sur le dataset de production. Vérifier textes, références, images, brouillons et articles ; comparer l'inventaire à l'export. Brancher une préproduction sur ce dataset et reprendre la recette des pages et de la preview. Vérifier séparément l'historique et la restauration proposés par le forfait Sanity réel ; ne pas les confondre avec un export indépendant.

Pour un incident de code, redéployer la dernière version validée avec ses dépendances verrouillées. Une restauration de code ne doit ni réinitialiser le contenu, ni republier les données de démonstration. Pour un incident de contenu, comparer d'abord les versions disponibles ou l'export dans l'environnement de test, obtenir l'autorisation pour l'opération de production, puis conserver une sauvegarde préalable de l'état courant.

Après restauration : contrôler santé HTTP, pages prioritaires, contact, secrets, cache, droits d'accès et images ; noter ce qui a été restauré et la perte de données éventuelle. Un objectif de délai de reprise ou de perte maximale ne peut être annoncé qu'après accord et exercice mesuré.

## Origine, proxy et protection du formulaire

La configuration lit SITE_URL pendant la compilation pour construire security.allowedDomains avec un hôte exact et HTTPS en hébergement. Renseigner cette valeur avant pnpm build, puis garder la même origine au runtime. Aucun wildcard n’est autorisé. Le proxy de confiance doit écraser X-Forwarded-Host, X-Forwarded-Proto et X-Forwarded-For ; fermer l’accès direct au processus Node. Sans cette précaution, les adresses fournies par un appelant ne constituent pas une identité de limitation fiable. Vérifier un POST réel sur l’origine HTTPS après déploiement. Le corps du formulaire est lu par flux avec une borne de 64 Kio ; les champs gardent leurs propres limites. L’adaptateur ajoute une borne générale de 128 Kio.

L’idempotence du formulaire évite les doubles soumissions applicatives pendant une heure sur une instance. Elle ne garantit pas une livraison SMTP exactement une fois si le serveur de courriel accepte un message puis perd son accusé de réception. Les corps ne sont ni journalisés ni conservés par la simulation ; le limiteur conserve temporairement un condensat signé d’adresse et le compteur, les réponses dédupliquées ne contiennent aucun message.
