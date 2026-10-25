# Architecture — CMS propriétaire Calas Conseil

## Décision

La demande du 25 octobre 2026 remplace Sanity, sans refaire le site public. Le dépôt de référence `ece27bd` conserve l’ancienne implémentation. Une seule application Astro SSR contient les pages publiques, les API et l’administration React. PostgreSQL 17 stocke contenu et authentification ; un bucket S3 privé stocke les fichiers. Aucun CRM, paiement, espace client ou microservice ajouté.

Astro rend le texte et les liens avant JavaScript. Le CSS public et GSAP restent distincts de l’administration Tailwind/shadcn. React, Tiptap, PDF.js et Tesseract ne sont chargés que dans les écrans privés nécessaires. Les polices demeurent locales. Le logo et ses exports utilisent la géométrie vectorielle unique ; voir LOGO.md.

## Contrat et contenu

`SiteContent` conserve accueil, pages, personnes, statistiques, articles et paramètres. Les champs historiques `_id`/`_key` deviennent `id`/`key`, les médias référencent un UUID interne et les textes riches sont du JSON Tiptap validé. Le convertisseur des anciens blocs signale les éléments inconnus au lieu de les perdre silencieusement.

`content_documents` porte identité, statut, version attendue et deux pointeurs : brouillon courant et dernière révision publiée. `content_revisions` contient des instantanés immuables, avec tables métier pages/articles/personnes/catégories/statistiques/paramètres et relations explicites. Clés étrangères et gardes SQL empêchent un pointeur vers la révision d’un autre document. Les publications valident les références ; des transactions et versions attendues renvoient 409 en cas de conflit.

Une restauration crée une nouvelle révision. Une archive retire la publication sans effacer l’historique. Les personnes et paramètres sont eux aussi versionnés. Le seed importe 17 ressources initiales sans articles inventés ; il préserve toute ressource existante. Le lecteur public utilise un instantané cohérent et seulement les pointeurs publiés. Il ne partage pas de cache en mémoire : une publication est visible à la requête suivante. Une panne donne 503, jamais les données de démonstration.

## Accès et frontières

Exception de recette autorisée par Paul le 25 octobre 2026 : un seul compte réservé `@example.test`, désigné par `AUTH_TEST_PASSWORD_ONLY_USER_ID`, peut accéder avec son mot de passe lorsque `SITE_ENV=staging` et que sa MFA n’est pas activée. L’exception ne valide artificiellement aucune session MFA ; elle ne s’applique ni en production ni aux autres comptes. Email vérifié, session réelle, rôle, absence de suspension, contrôle d’origine et absence de cache restent obligatoires. Les règles MFA ci-dessous restent la règle générale. Cette exception doit être retirée avant le lancement définitif.

Better Auth gère mots de passe, sessions, vérification d’adresse, réinitialisation et TOTP. Le schéma Drizzle correspond à la version épinglée. Les cookies sont HttpOnly, SameSite=Lax et Secure sous HTTPS ; les sessions durent 8 h, sans cache de cookie. Aucun jeton dans localStorage. L’inscription publique et la désactivation MFA sont exclues des routes exposées.

Une session avant enrollment reste marquée non validée ; elle ne devient pas autorisée parce que l’utilisateur a ensuite activé TOTP ailleurs. Chaque API privée revérifie email, session, MFA, rôle et suspension. Administrateur : utilisateurs et réglages ; éditeur : contenus autorisés. Les contrôles ne reposent pas sur les boutons visibles. Les invitations expirent après 24 h et ne sont utilisables qu’une fois ; leur secret est stocké sous empreinte. Un changement de droits ou une suspension révoque les sessions concernées. Le dernier administrateur actif est protégé.

Les mutations exigent l’origine canonique ; la taille des corps est bornée avant lecture complète. Better Auth utilise une limitation en base, complétée par un compteur SQL atomique aux frontières sensibles. Le helper d’adresse ignore les en-têtes clients par défaut. `TRUST_RAILWAY_PROXY=true` active uniquement `X-Real-IP` pour une origine exclusivement accessible via le proxy Railway.

`?preview=1` seul n’accorde aucun accès. La preview emploie les pages réelles et la session serveur ; cache privé désactivé, noindex, Referrer-Policy no-referrer et iframe même origine. Les redirections restent sur des routes publiques locales. CSP avec nonce pour les scripts, rendu riche par liste autorisée et échappement des textes ; les fichiers disposent d’une CSP plus restrictive.

## Médias et OCR

Le bucket ne possède aucune ACL publique. Le proxy `/media/{id}/` vérifie une session autorisée ou une référence actuellement publiée ; les PDF exigent en plus une autorisation éditoriale de téléchargement. Dépublier révoque cet accès. Les images sont décodées et réencodées avec Sharp ; tailles, dimensions, type réel et MIME sont contrôlés. SVG/HTML exécutables refusés. Variantes 320/960/1920 et métadonnées alt/cadrage/point focal. Les références de l’historique protègent les suppressions ; un remplacement conserve l’identité du média. Les échecs de nettoyage S3 sont suivis par une file de suppression en base.

PDF.js extrait le texte natif, Tesseract traite les scans ou pages mixtes. Les workers et modèles français/anglais sont servis localement. Analyse, progression, annulation et aperçu précèdent toute écriture. La confirmation téléverse le PDF privé et crée un brouillon idempotent, à relire, sans auteur/date inventés. La publication applique les mêmes validations que tout article.

## Contact, services et opérations

Le contact conserve toutes ses protections. En mode PostgreSQL, un verrou transactionnel par jeton évite les envois concurrents ; seuls des HMAC et le résultat générique sont conservés une heure, jamais le message. Le débit est commun aux processus. SMTP et transaction SQL ne constituent pas une transaction distribuée : après perte de confirmation du fournisseur ou incident après envoi, une nouvelle tentative peut produire un doublon ; aucune garantie absolue de livraison unique n’est revendiquée.

Pool PostgreSQL borné, connexions paresseuses, délais de connexion/requête, réponses génériques sans chaîne de connexion dans les journaux. `/api/health/` indique la vie du processus ; `/api/ready/` vérifie configuration, schéma et bucket, sans révéler de détails. Les migrations, imports, publication initiale et restauration sont des commandes volontaires. L’application ne les exécute jamais au démarrage.

Sauvegarde PostgreSQL+S3 chiffrée et restauration dans des destinations vides : BACKUP.md. Configuration Railway, SMTP, maintenance et retour arrière : DEPLOYMENT.md. La recette locale est distincte de la validation de l’hébergement futur.
