# Courriel Calas Conseil

## Messagerie en service depuis novembre 2026

L’unique boîte publique est **contact@calas-conseil.fr**, partagée par Sara et Agnès. Elle utilise Zimbra Starter chez OVHcloud. Elles peuvent la consulter dans [le webmail](https://mail.ovh.net/modern/) ou dans Outlook par IMAP sécurisé sur `imap.mail.ovh.net:993` et SMTP sécurisé sur `smtp.mail.ovh.net:465`. L’identifiant est l’adresse complète.

Le site affiche cette adresse sur la page Contact, en pied de page et dans les informations légales. Le formulaire envoie depuis et vers cette boîte. Répondre à l’alerte adresse la réponse au visiteur via le champ `Reply-To`. Les trois comptes personnels de l’administration utilisent leurs propres adresses pour les liens de vérification et de réinitialisation.

Les demandes sont supprimées de la messagerie au plus tard trois ans après le dernier échange, hors pièces à conserver au titre des obligations contractuelles. Sara et Agnès assurent cette suppression dans la boîte. Les identifiants SMTP restent dans les variables privées du service Railway. La zone DNS OVH publie MX, SPF, DKIM et DMARC.

Les sections datées ci-dessous conservent l’historique des offres envisagées avant la création de la boîte.

## Domaine et adresses envisagés — état au 2 novembre 2026

Paul envisage désormais le domaine **calas-conseil.fr**, avec un tiret, et a demandé les explications nécessaires pour que Sara l’achète. Il souhaite pouvoir disposer de plusieurs adresses, par exemple **sara@calas-conseil.fr** et **agnes@calas-conseil.fr**. Le nombre de boîtes, leurs noms, le fournisseur et l’offre restent à confirmer. Il s’agit de boîtes capables de recevoir et d’envoyer des messages, pas seulement de liens affichés sur le site.

Le domaine n’est pas acheté et aucune boîte professionnelle n’est créée. Aucun abonnement, achat de domaine, changement DNS ou envoi de message n’a été effectué. La demande initiale du 1er novembre portait sur une seule boîte `sara@calasconseil.fr` ; les vérifications et la comparaison d’offres ci-dessous conservent cet historique et ne constituent pas une vérification de disponibilité du nouveau nom avec tiret.

## Historique — état vérifié le 1er novembre 2026

- Aucun fournisseur de domaine ou de messagerie n'est renseigné dans les documents du projet. Le domaine `calasconseil.fr` y figure comme domaine souhaité.
- La résolution DNS locale et une requête indépendante à Google Public DNS renvoient `NXDOMAIN` pour `calasconseil.fr` : aucun serveur NS, MX ou enregistrement TXT n'est retourné. La requête `_dmarc.calasconseil.fr` retourne également `NXDOMAIN`.
- Le [service RDAP officiel de l'AFNIC](https://rdap.nic.fr/domain/calasconseil.fr) retourne HTTP 404. Le domaine paraît donc non enregistré ou non publié au moment du contrôle. Cela ne réserve pas le nom et ne garantit pas sa disponibilité lors d'une commande.
- Aucun accès à un fournisseur de domaine ou de messagerie n'est disponible dans les outils connectés. Les accès Railway existants concernent l'application, PostgreSQL et le stockage des médias.
- Le formulaire hébergé reste en simulation (`MAIL_TRANSPORT=simulation`, `ALLOW_REAL_EMAIL=false`) ; le transport des courriels de compte est désactivé (`AUTH_MAIL_TRANSPORT=disabled`).

## Informations et accès nécessaires

1. Vérifier la disponibilité de `calas-conseil.fr` au moment de la commande et créer le compte fournisseur au nom du titulaire retenu par Calas Conseil. Aucune transmission de mot de passe dans le chat n’est nécessaire.
2. Confirmer le nombre d’adresses et distinguer les boîtes indépendantes des alias : un alias distribue vers une boîte existante, tandis qu’une boîte indépendante possède ses propres messages et accès. Présenter le prix total du domaine et des boîtes, leur renouvellement et le titulaire avant tout achat.
3. Après achat par Sara et accès au fournisseur, créer les boîtes retenues et régler MX, SPF, DKIM et DMARC avec les valeurs propres à l’offre. Ne pas inventer des valeurs DNS génériques.
4. Remettre les accès de manière privée. Les exemples `sara` et `agnes` ne prouvent ni leur création ni une validation du nombre final ; ne pas ajouter d’abonnement ou d’adresse non retenus.

## Historique — comparaison du 1er novembre pour une seule boîte

**La proposition initiale était de réserver `calasconseil.fr` pour un an chez OVHcloud, puis d’utiliser la boîte Starter incluse pour `sara@calasconseil.fr`.** Les pages officielles consultées le 1er novembre 2026 annonçaient les montants suivants, avec TVA française de 20 %. Cette estimation historique couvre une seule boîte ; elle doit être refaite pour le domaine avec tiret et le nombre de boîtes retenu.

| Élément | Première année | Renouvellement annuel au tarif affiché |
| --- | --- | --- |
| Domaine `.fr` | 4,99 € HT / **5,99 € TTC** | 7,79 € HT / **9,35 € TTC** |
| Une boîte Starter liée au domaine | Incluse, sans supplément | Incluse avec le domaine |
| Total proposé | **4,99 € HT / 5,99 € TTC** | **7,79 € HT / 9,35 € TTC** |

Ces prix proviennent de la [fiche officielle du domaine `.fr`](https://www.ovhcloud.com/fr/domains/tld/fr/). La [page Domaines](https://www.ovhcloud.com/fr/domains/) et la [comparaison des services inclus](https://www.ovhcloud.com/fr/web-hosting/eco/) annoncent une boîte Starter de 15 Go incluse avec chaque domaine. La [documentation Zimbra](https://docs.ovhcloud.com/fr/guides/web-cloud/email-and-collaborative-solutions/zimbra/getting-started-zimbra) confirme que le service lié à un domaine apparaît comme gratuit. Le webmail et les protocoles IMAP/POP/SMTPS permettent lecture, réception et envoi ; voir les [caractéristiques Starter](https://www.ovhcloud.com/fr/emails/).

Il suffit de commander le domaine avec son service mail inclus. L'abonnement Zimbra Starter vendu séparément à 0,30 € HT/mois n'est pas nécessaire pour cette première boîte incluse. Le site Astro reste hébergé sur Railway : aucun pack web payant OVHcloud n'est nécessaire pour créer cette adresse.

Le calcul initial portait sur **un domaine, une année et une boîte incluse**. Le futur panier doit refléter le domaine avec tiret et le nombre de boîtes finalement choisi, avec le titulaire, les coordonnées de facturation et le montant final confirmés. La promotion pluriannuelle affichée sur la page `.fr` n’est pas utilisée dans ce calcul historique. La disponibilité et les tarifs devront être revérifiés au moment de l’achat. Rien n’a été commandé.

Point à confirmer avant validation du panier : une [autre page OVHcloud sur l'hébergement gratuit](https://www.ovhcloud.com/fr/domains/free-web-hosting/) mentionne encore une boîte de 5 Go. Les pages Domaines et Eco annoncent 15 Go ; l'offre effectivement provisionnée et son quota doivent donc être contrôlés dans le récapitulatif, sans présenter cette capacité comme déjà acquise.

Une fois le domaine réservé, ouvrir **Web Cloud → Zimbra Mail**, vérifier le service gratuit lié au domaine, associer le domaine et créer le compte `sara`. La configuration recommandée du fournisseur prépare les enregistrements MX/SPF/DKIM ; vérifier ensuite leurs diagnostics et configurer DMARC. Si le service reçu est de type MX Plan, suivre son écran d'activation spécifique. Les identifiants sont remis de façon privée ; aucun test d'envoi n'est exécuté sans autorisation.

### Alternative IONOS

L'offre [Email Basic 1](https://www.ionos.fr/solutions-bureau/adresse-email.html) affiche **1,50 € HT / 1,80 € TTC par mois**, avec une boîte de 2 Go, webmail et domaine inclus pendant le contrat, résiliable à tout moment. L'équivalent sur douze mois est **18 € HT / 21,60 € TTC** ; aucune remise temporaire n'est affichée pour cette formule. Le maintien du domaine inclus dépend du maintien du contrat et de son emplacement de domaine ; les [règles officielles des domaines inclus](https://www.ionos.fr/assistance/domaines/tarifs-et-factures/domaines-inclus-reponses-aux-questions-frequemment-posees/) détaillent ce fonctionnement et les extensions admissibles.

Cette alternative avait également été examinée pour une seule boîte ; au tarif annuel vérifié le 1er novembre, la proposition OVHcloud avec boîte incluse était plus économique pour ce périmètre. Le coût de plusieurs boîtes reste à comparer. Aucun abonnement de messagerie ne doit être ajouté au projet sans nécessité et validation.

## Projet de raccordement envisagé avant le choix de la boîte partagée (historique)

- L'adresse publique du site doit correspondre à la boîte réellement créée. Un texte ou lien `mailto:` ne prouve pas que la réception fonctionne.
- Si cette boîte est retenue et créée, le formulaire pourra utiliser `SMTP_TO=sara@calas-conseil.fr`. Le destinataire réel reste à confirmer. L’expéditeur SMTP doit être autorisé par le fournisseur ; l’adresse du visiteur est placée dans `Reply-To`, jamais utilisée comme expéditeur du domaine.
- Les secrets SMTP restent dans les variables privées du serveur. L'activation du transport réel et le test de réception nécessitent l'autorisation de recette prévue dans `AGENTS.md` ; aucun email de test n'est envoyé à Sara par défaut.
- Vérifier réception, réponse et authentification du domaine lors d'un test autorisé, puis documenter le fournisseur, l'accès, la conservation des messages et la récupération du compte.

Voir aussi [le déploiement et la délivrabilité](DEPLOYMENT.md#smtp-et-délivrabilité) et [la validation avant production](VALIDATION.md).
