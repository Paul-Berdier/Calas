# Proposition de réalisation, hébergement et maintenance

Document de cadrage à chiffrer et à approuver. Aucun montant de prestation, abonnement, engagement de maintenance ou achat de domaine n'est considéré comme accepté.

## Réalisation ponctuelle

Le périmètre comprend l'identité vectorielle corrigée et ses variantes, l'animation GSAP, le site Astro responsive, le CMS propriétaire PostgreSQL et son administration pour pages et articles, le formulaire serveur, les pages techniques et éditoriales prévues au brief, la recette documentée et la remise des sources. La réception comporte une revue accueil/Diagnostic, une relecture générale et une recette des services externes raccordés.

Le chiffrage final doit distinguer la construction livrée, les ajustements issus des validations, le raccordement PostgreSQL, S3 et de l’authentification, la mise en place du transport email, le déploiement et la prise en main par Sara. La rédaction d'articles définitifs, les portraits, la validation juridique et les services non demandés ne sont pas inclus tacitement.

## Hébergement et services récurrents

| Poste | Besoin | Condition de choix |
| --- | --- | --- |
| Domaine | Domaine souhaité `calasconseil.fr` | Disponibilité à vérifier ; titulaire Calas Conseil ; achat soumis à accord |
| Application web | Hébergement Node pour Astro SSR, HTTPS, logs maîtrisés | Choisir capacité, région, coût, sauvegarde de configuration et responsabilité d'exploitation |
| PostgreSQL et S3 privé | Contenus, comptes, historique et médias | Services détenus par Calas Conseil ; région, capacité, sauvegardes et coûts approuvés |
| Courriel | Transport SMTP ou transactionnel authentifié | Expéditeur autorisé, délivrabilité, rétention et tarif approuvés |
| Sauvegardes | Code, export de contenu et médias | Stockage sous contrôle du cabinet, accès restreint et test de restauration |

Le CMS propriétaire ne requiert aucun abonnement Sanity. Son exploitation nécessite PostgreSQL, un bucket S3 privé et un transport de courriel. Les tarifs Railway et SMTP seront vérifiés au choix effectif de la région, de la capacité et du fournisseur ; aucun prix ni abonnement n’est accepté par ce document.

## Maintenance à contractualiser séparément

- Mises à jour de sécurité et de dépendances, avec recette avant mise en ligne.
- Contrôle de disponibilité et du formulaire, suivi des capacités PostgreSQL/S3/courriel et traitement des alertes.
- Sauvegardes périodiques, rétention choisie et restauration testée.
- Assistance éditoriale et évolution du contenu, selon un volume défini.
- Contrôle périodique des sources chiffrées, liens et informations juridiques par le responsable désigné.

Définir la fréquence d'intervention, les délais de réponse, les heures couvertes, les exclusions, le plafond budgétaire, la réversibilité et la procédure de résiliation. Les objectifs de disponibilité, délai de rétablissement et perte de données acceptable doivent être convenus avant d'être annoncés.

## Propriété et réversibilité

Remettre à Sara les accès administratifs au domaine, à l'hébergement et aux services PostgreSQL et S3, ainsi que les sources, licences des dépendances et polices, exports de contenu/médias, secrets à recréer et procédures. Les comptes restent au nom de Calas Conseil. Aucune réimportation de données de démonstration ne fait partie d'un déploiement normal.
