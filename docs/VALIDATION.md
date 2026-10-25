# Revue éditoriale et autorisation de publication

État de départ : développement local. Aucun domaine réservé, service payant souscrit ou site de production publié. Le brief exige la validation de l'accueil et de Diagnostic par Sara et Agnès, puis une relecture générale avant publication. Ce document est une liste de décision ; les résultats réellement exécutés sont consignés séparément dans le compte rendu de tests.

## Revue 1 — Accueil et Diagnostic

À examiner ensemble sur ordinateur et mobile, à partir des captures de recette et du site local :

- [ ] Le nom comporte un seul s ; la signature, les proportions du coquillage et la dorure sont approuvées.
- [ ] L'accueil conserve les six blocs et le H1 long demandé ; aucun changement de promesse n'est passé silencieusement.
- [ ] Le diagnostic et la prévention des RPS constituent bien l'entrée principale.
- [ ] La qualité du lien différencie le cabinet sans réduire les difficultés aux émotions individuelles.
- [ ] Les quatre statistiques ont leurs périmètres, millésimes et sources lisibles ; les corrections de `SOURCES.md` sont acceptées.
- [ ] Diagnostic présente les cinq étapes, les facteurs de risque, les livrables et les règles de confidentialité.
- [ ] Le rôle du binôme et la limite de ce que le diagnostic promet sont exacts.
- [ ] Les CTA sont faciles à trouver sur mobile ; l'objet Diagnostic est présélectionné au contact.
- [ ] L’enroulement de l’extérieur vers le noyau est approuvé au début, au milieu et à la fin ; les cinq rubans se courbent progressivement et le bloc reste fixe, sans parallaxe. Le logo complet retrouve exactement sa géométrie finale et reste correct sur fond clair et sombre, sans JavaScript et en mouvement réduit.

Décision à consigner : date, noms des personnes ayant relu, version du code, fichiers des captures, réserves éventuelles. Une approbation visuelle ne valide pas automatiquement les mentions légales, les comptes externes ou la délivrabilité.

## Informations à obtenir

| Élément | Décision attendue | Comportement avant validation |
| --- | --- | --- |
| Portraits Sara et Agnès | Fichiers authentiques, droits d'usage, cadrages et textes alternatifs | Présentation typographique, aucun faux portrait |
| Agnès | Biographie et rôle précis dans le diagnostic | Nom et qualité fournis seulement |
| IPRP Sara | Attestation, numéro, autorité/région et validité | Qualification non affichée ; justificatif privé hors CMS public |
| Articles | Textes finaux, auteur, date et droits des images | État vide propre ; démonstration éventuelle réservée aux brouillons |
| Conférence | Durée définitive | Pas de durée de 1 h 30 annoncée comme acquise |
| Managers | Durée, rythme, format | Champs éditables, pas d'engagement inventé |
| LinkedIn | URL exacte | Lien masqué |
| Coordonnées | Email définitif et téléphone confirmé | Coordonnées fournies dans le brief |
| Géographie | Implantation et zone d'intervention | Aucune localisation inventée |
| Identité juridique | Nom légal, forme, SIREN/SIRET si applicable, adresse, directeur de publication | Pas de données factices |
| Données personnelles | Responsable, destinataires, base légale, conservation, contact droits, sous-traitants | Revue nécessaire avant collecte réelle |
| Domaine/hébergement | Propriété Calas Conseil, budget et administrateur | Aucune disponibilité ni propriété présumée |
| CMS propriétaire | Adresse du premier responsable, accès Sara, PostgreSQL et S3 de production | Recette locale vérifiée ; accès du cabinet et hébergement à configurer |
| Courriel | Expéditeur autorisé, transport authentifié, destinataire et test autorisé | Simulation ou boîte locale ; aucun email envoyé à Sara pendant la recette |

## Revue 2 — Avant production

- [ ] Toutes les pages ont été relues, y compris les métadonnées, les pages légales et les états vides.
- [ ] Aucun texte de travail, faux visuel, faux témoignage ou qualification non vérifiée n'apparaît publiquement.
- [ ] Sara possède les accès administratifs ; les rôles correspondent aux responsabilités retenues.
- [ ] Un paragraphe et une image ont été modifiés dans l’administration ; l’affichage public est vérifié après publication.
- [ ] Un article a été créé, prévisualisé, publié puis vérifié dans la recette isolée ; aucun brouillon n'est accessible au visiteur public.
- [ ] Prévisualisation, cookies, iframe, CORS et isolation du cache sont testés dans les navigateurs retenus.
- [ ] Une sauvegarde des documents **et des médias** a été restaurée dans une base et un bucket isolés ; historique, comptes et médias vérifiés.
- [ ] Le SMTP a passé un test autorisé : destinataire, Reply-To, SPF/DKIM/DMARC, réception et indésirables vérifiés.
- [ ] Le formulaire informe sur les traitements réels ; les journaux et copies éventuelles ont une durée de suppression définie.
- [ ] Navigation clavier, zoom, tailles 360/390/768/1280/1440, mouvement réduit et contenus longs ont été revus.
- [ ] Les parcours de contact, indisponibilité, nouvelle tentative, double clic et limite de débit ont été vérifiés.
- [ ] Les mesures de ressources et Lighthouse correspondent au build livré et à un protocole documenté ; aucune mesure de terrain n'est revendiquée sans trafic.
- [ ] HTTPS, domaine, canonicals, sitemap et robots correspondent à l'environnement cible ; les brouillons restent sans indexation.
- [ ] Les accès, sauvegardes, alertes et responsables de maintenance sont remis.
- [ ] Sara et Agnès ont autorisé la mise en production après relecture ; tout achat est approuvé séparément.

Les travaux locaux réversibles peuvent continuer pendant la relecture. Une case non cochée n'est pas un test réussi ; les raccordements externes ne deviennent vérifiés qu'après exécution réelle.
