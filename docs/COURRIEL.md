# Courriel Calas Conseil

## Adresse demandée

Paul a demandé le 1er novembre 2026 une seule boîte professionnelle : **sara@calasconseil.fr**. Cette demande concerne une boîte capable de recevoir et d'envoyer des messages, pas seulement un lien affiché sur le site.

La boîte n'est pas encore créée. Aucun abonnement, achat de domaine, changement DNS ou envoi de message n'a été effectué.

## État vérifié le 1er novembre 2026

- Aucun fournisseur de domaine ou de messagerie n'est renseigné dans les documents du projet. Le domaine `calasconseil.fr` y figure comme domaine souhaité.
- La résolution DNS locale et une requête indépendante à Google Public DNS renvoient `NXDOMAIN` pour `calasconseil.fr` : aucun serveur NS, MX ou enregistrement TXT n'est retourné. La requête `_dmarc.calasconseil.fr` retourne également `NXDOMAIN`.
- Le [service RDAP officiel de l'AFNIC](https://rdap.nic.fr/domain/calasconseil.fr) retourne HTTP 404. Le domaine paraît donc non enregistré ou non publié au moment du contrôle. Cela ne réserve pas le nom et ne garantit pas sa disponibilité lors d'une commande.
- Aucun accès à un fournisseur de domaine ou de messagerie n'est disponible dans les outils connectés. Les accès Railway existants concernent l'application, PostgreSQL et le stockage des médias.
- Le formulaire hébergé reste en simulation (`MAIL_TRANSPORT=simulation`, `ALLOW_REAL_EMAIL=false`) ; le transport des courriels de compte est désactivé (`AUTH_MAIL_TRANSPORT=disabled`).

## Informations et accès nécessaires

1. Confirmer si Calas Conseil possède déjà le domaine et, si oui, ouvrir le compte de son fournisseur. Aucune transmission de mot de passe dans le chat n'est nécessaire.
2. Si le domaine n'est pas détenu, choisir une offre au nom de Calas Conseil avec une seule boîte `sara`. Présenter le prix du domaine et de la boîte, leur renouvellement et le titulaire avant tout achat.
3. Utiliser l'accès au fournisseur pour créer la boîte et régler ses enregistrements MX, SPF, DKIM et DMARC avec les valeurs propres à l'offre retenue. Ne pas inventer des valeurs DNS génériques.
4. Remettre l'accès de manière privée. Ne pas créer automatiquement des boîtes `contact`, `agnes` ou `noreply` ; une adresse unique a été demandée.

## Option concrète à valider : domaine OVHcloud et boîte incluse

**Proposition : réserver `calasconseil.fr` pour un an chez OVHcloud, puis utiliser l'unique boîte Starter incluse pour `sara@calasconseil.fr`.** Les pages officielles consultées le 1er novembre 2026 annoncent les montants suivants, avec TVA française de 20 % :

| Élément | Première année | Renouvellement annuel au tarif affiché |
| --- | --- | --- |
| Domaine `.fr` | 4,99 € HT / **5,99 € TTC** | 7,79 € HT / **9,35 € TTC** |
| Une boîte Starter liée au domaine | Incluse, sans supplément | Incluse avec le domaine |
| Total proposé | **4,99 € HT / 5,99 € TTC** | **7,79 € HT / 9,35 € TTC** |

Ces prix proviennent de la [fiche officielle du domaine `.fr`](https://www.ovhcloud.com/fr/domains/tld/fr/). La [page Domaines](https://www.ovhcloud.com/fr/domains/) et la [comparaison des services inclus](https://www.ovhcloud.com/fr/web-hosting/eco/) annoncent une boîte Starter de 15 Go incluse avec chaque domaine. La [documentation Zimbra](https://docs.ovhcloud.com/fr/guides/web-cloud/email-and-collaborative-solutions/zimbra/getting-started-zimbra) confirme que le service lié à un domaine apparaît comme gratuit. Le webmail et les protocoles IMAP/POP/SMTPS permettent lecture, réception et envoi ; voir les [caractéristiques Starter](https://www.ovhcloud.com/fr/emails/).

Il suffit de commander le domaine avec son service mail inclus. L'abonnement Zimbra Starter vendu séparément à 0,30 € HT/mois n'est pas nécessaire pour cette première boîte incluse. Le site Astro reste hébergé sur Railway : aucun pack web payant OVHcloud n'est nécessaire pour créer cette adresse.

Lors de la commande, vérifier le panier pour **un seul domaine, une seule année et une seule boîte incluse**, puis confirmer le titulaire, les coordonnées de facturation et le montant final. La promotion pluriannuelle affichée sur la page `.fr` n'est pas utilisée dans ce calcul. La disponibilité et les tarifs devront être revérifiés au moment de l'achat. Rien n'a été commandé.

Point à confirmer avant validation du panier : une [autre page OVHcloud sur l'hébergement gratuit](https://www.ovhcloud.com/fr/domains/free-web-hosting/) mentionne encore une boîte de 5 Go. Les pages Domaines et Eco annoncent 15 Go ; l'offre effectivement provisionnée et son quota doivent donc être contrôlés dans le récapitulatif, sans présenter cette capacité comme déjà acquise.

Une fois le domaine réservé, ouvrir **Web Cloud → Zimbra Mail**, vérifier le service gratuit lié au domaine, associer le domaine et créer le compte `sara`. La configuration recommandée du fournisseur prépare les enregistrements MX/SPF/DKIM ; vérifier ensuite leurs diagnostics et configurer DMARC. Si le service reçu est de type MX Plan, suivre son écran d'activation spécifique. Les identifiants sont remis de façon privée ; aucun test d'envoi n'est exécuté sans autorisation.

### Alternative IONOS

L'offre [Email Basic 1](https://www.ionos.fr/solutions-bureau/adresse-email.html) affiche **1,50 € HT / 1,80 € TTC par mois**, avec une boîte de 2 Go, webmail et domaine inclus pendant le contrat, résiliable à tout moment. L'équivalent sur douze mois est **18 € HT / 21,60 € TTC** ; aucune remise temporaire n'est affichée pour cette formule. Le maintien du domaine inclus dépend du maintien du contrat et de son emplacement de domaine ; les [règles officielles des domaines inclus](https://www.ionos.fr/assistance/domaines/tarifs-et-factures/domaines-inclus-reponses-aux-questions-frequemment-posees/) détaillent ce fonctionnement et les extensions admissibles.

Cette alternative répond également au besoin, mais l'offre OVHcloud avec boîte incluse est plus économique au tarif annuel vérifié. Aucun second abonnement de messagerie ne doit être ajouté au projet sans nécessité et validation.

## Raccordement au site après création

- L'adresse publique du site doit correspondre à la boîte réellement créée. Un texte ou lien `mailto:` ne prouve pas que la réception fonctionne.
- Le formulaire pourra utiliser `SMTP_TO=sara@calasconseil.fr`. L'expéditeur SMTP doit être autorisé par le fournisseur ; l'adresse du visiteur est placée dans `Reply-To`, jamais utilisée comme expéditeur du domaine.
- Les secrets SMTP restent dans les variables privées du serveur. L'activation du transport réel et le test de réception nécessitent l'autorisation de recette prévue dans `AGENTS.md` ; aucun email de test n'est envoyé à Sara par défaut.
- Vérifier réception, réponse et authentification du domaine lors d'un test autorisé, puis documenter le fournisseur, l'accès, la conservation des messages et la récupération du compte.

Voir aussi [le déploiement et la délivrabilité](DEPLOYMENT.md#smtp-et-délivrabilité) et [la validation avant production](VALIDATION.md).
