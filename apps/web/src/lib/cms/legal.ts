import type { Page, Section } from './types';

export const contactEmail = 'contact@calas-conseil.fr';
export const interventionArea: Section = {
  key: 'zones-intervention',
  kind: 'text',
  title: 'Où intervenons-nous ?',
  text: 'Nous intervenons en Charente et en Charente-Maritime, ainsi qu’à Bordeaux et à Toulouse.',
};
export const contactDescription = 'Contactez Calas Conseil pour un diagnostic RPS ou un accompagnement des équipes et des managers en Charente, en Charente-Maritime, à Bordeaux et à Toulouse.';

const section = (key: string, title: string, text: string): Section => ({ key, title, text, kind: 'text', presentation: 'default' });

export const legalNotice: Page = {
  id: 'page-legal',
  slug: 'mentions-legales',
  eyebrow: 'Informations du site',
  title: 'Mentions légales',
  intro: 'Calas Conseil est le nom commercial sous lequel Sara Serrano Cabeza et Agnès Loupias exercent en entreprise individuelle. Sara Serrano Cabeza établit les devis et les factures.',
  sections: [
    section('publication', 'Édition et direction de la publication',
      'Sara Serrano Cabeza, entrepreneure individuelle exerçant sous le nom commercial Calas Conseil, est l’éditrice du site et sa directrice de la publication.'),
    section('sara', 'Sara Serrano Cabeza, EI',
      'Entrepreneure individuelle au régime de la micro-entreprise. SIREN 501 254 429. SIRET 501 254 429 00027. Immatriculée au registre national des entreprises depuis le 13 mai 2026. Adresse professionnelle : 10 allée Jacqueline Auriol, 16600 Magnac-sur-Touvre, France.'),
    section('agnes', 'Agnès Loupias, EI',
      'Entrepreneure individuelle au régime de la micro-entreprise. SIREN 878 000 165. SIRET 878 000 165 00026. Immatriculée au registre national des entreprises depuis le 15 octobre 2019. Adresse professionnelle : 11 rue Louis Renault, 31130 Balma, France.'),
    section('contact', 'Nous joindre',
      `Pour toute question concernant le site, écrivez à ${contactEmail} ou appelez le 06 43 16 83 81.`),
    section('hebergement', 'Hébergement',
      'Railway Corporation, 548 Market Street, Suite 68956, San Francisco, CA 94104, États-Unis. Téléphone : +1 415 707 7675. Courriel : team@railway.com.'),
    section('propriete', 'Propriété intellectuelle',
      'Les textes, illustrations, outils et signes distinctifs présentés sur ce site appartiennent à leurs auteurs ou titulaires de droits respectifs. Pour toute réutilisation dépassant les exceptions prévues par la loi, contactez-nous.'),
  ],
};

export const privacyNotice: Page = {
  id: 'page-privacy',
  slug: 'confidentialite',
  eyebrow: 'Vos données',
  title: 'Confidentialité',
  intro: 'Lorsque vous nous écrivez, Sara Serrano Cabeza et Agnès Loupias reçoivent votre demande dans la boîte professionnelle partagée de Calas Conseil.',
  sections: [
    section('responsable', 'Responsable du traitement',
      `Sara Serrano Cabeza, EI, est responsable du traitement des données du formulaire. Vous pouvez lui écrire à ${contactEmail} ou à son adresse professionnelle, 10 allée Jacqueline Auriol, 16600 Magnac-sur-Touvre, France.`),
    section('form', 'Répondre à votre demande',
      'Le formulaire demande votre nom, votre adresse électronique, l’objet de votre demande et votre message. Votre organisation, votre fonction et votre téléphone sont facultatifs. Vous donnez votre consentement en cochant la case du formulaire. Nous utilisons ces informations pour répondre à votre demande et échanger avec vous à son sujet. Évitez d’y inclure des informations médicales ou des renseignements concernant un tiers.'),
    section('destinataires', 'Qui reçoit votre message ?',
      `Sara Serrano Cabeza et Agnès Loupias consultent la boîte ${contactEmail}, hébergée par OVHcloud. Railway Corporation héberge le formulaire et la base technique dans sa région européenne aux Pays-Bas. Railway est établie aux États-Unis. Son accord de traitement prévoit des clauses contractuelles types pour les transferts hors de l’Espace économique européen qui en relèvent. Vous pouvez nous demander des précisions sur ces garanties.`),
    section('conservation', 'Conservation des données',
      'Les messages de contact sont conservés dans la messagerie pour le suivi de votre demande et supprimés au plus tard trois ans après le dernier échange. Si une prestation est conclue, les pièces nécessaires au respect des obligations contractuelles sont conservées séparément pendant la durée applicable. La base du site conserve des empreintes techniques pour prévenir les doublons et les envois abusifs. La vérification d’un doublon expire après une heure et la limite d’envoi s’applique sur quinze minutes.'),
    section('droits', 'Vos droits',
      `Vous pouvez retirer votre consentement à tout moment et demander l’accès, la rectification, l’effacement, la limitation du traitement ou, lorsque les conditions sont réunies, la portabilité de vos données. Votre droit d’opposition s’applique aux traitements fondés sur l’intérêt légitime, notamment la prévention des abus. Écrivez à ${contactEmail} ou utilisez nos adresses postales figurant dans les mentions légales. Vous pouvez aussi adresser une réclamation à la Commission nationale de l’informatique et des libertés (CNIL) sur cnil.fr.`),
    section('traceurs', 'Navigation sur le site',
      'Les liens de campagne peuvent comporter un code commun à tous leurs destinataires. Il sert à compter les arrivées et les pages consultées par campagne et par jour. Ces compteurs ne contiennent ni adresse électronique, ni adresse IP, ni identifiant de visiteur, et ne sont pas rapprochés des fiches de contact. Aucun cookie de mesure, empreinte du navigateur ou pixel d’ouverture des courriels n’est utilisé. Le lien « Arrêter cette mesure » retire le code de la navigation en cours. Les compteurs peuvent inclure plusieurs consultations par une même personne. Les polices sont hébergées avec le site. L’administration et la prévisualisation utilisent des cookies techniques pour la connexion et la sécurité des comptes.'),
    section('prospection', 'Contacts professionnels et prospection',
      `Calas Conseil peut contacter des professionnels au sujet de prestations en rapport avec leur fonction, sur le fondement de son intérêt légitime à développer son activité. La provenance de l’adresse est indiquée dans le message. Le nom, l’adresse professionnelle, l’entreprise, la fonction et les échanges utiles au suivi sont accessibles aux personnes habilitées de Calas Conseil. Les données de prospection sont supprimées au plus tard trois ans après leur collecte ou le dernier échange du contact. Chaque message comporte un lien de désinscription ; vous pouvez aussi écrire à ${contactEmail}. Une empreinte de l’adresse est conservée pour respecter l’opposition, y compris lors d’un nouvel import. Les données techniques de limitation des abus sont distinctes des statistiques de campagne. Les assistants connectés par une personne habilitée peuvent accéder aux données dans la limite des droits accordés ; leur utilisation doit respecter la confidentialité des données et les conditions du service choisi.`),
  ],
};
