import type { SiteContent } from './types';
import { linkedinArticles } from './linkedin-articles';

// Contenus issus du cahier des charges du 31 octobre 2026. Relecture avant lancement définitif.
// Mode de recette explicite, jamais un repli après une panne du CMS.
export const demoContent: SiteContent = {
  "settings": {
    "brand": "Calas Conseil",
    "tagline": "La voie de la qualité relationnelle.",
    "phone": "06 43 16 83 81",
    "email": "saraserranocabeza@gmail.com",
    "qualification": {
      "status": "pending",
      "label": "IPRP enregistrée auprès de la DREETS Nouvelle-Aquitaine",
      "registration": "2026.16.004",
      "personId": "person-sara"
    },
    "footerText": "Construire la performance durable par la qualité du lien.",
    "contactText": "Un premier échange pour comprendre votre situation et envisager la suite, ensemble."
  },
  "home": {
    "eyebrow": "La voie de la qualité relationnelle",
    "title": "Construire la performance durable par la qualité du lien",
    "intro": "La qualité des relations entre les personnes est au cœur de l’engagement, de la santé et de la performance. Calas Conseil fait du lien une véritable compétence, qui s’apprend, se pratique et se cultive.",
    "primaryCta": {
      "label": "Échanger sur vos priorités",
      "href": "/contact/"
    },
    "secondaryCta": {
      "label": "Découvrir notre approche",
      "href": "/notre-approche/"
    },
    "statisticsTitle": "Quelques repères",
    "statisticsTransition": "Derrière ces chiffres, chaque organisation a sa réalité. La comprendre, c’est se donner les moyens d’agir.",
    "statistics": [
      {
        "id": "stat-stress",
        "value": "39 %",
        "label": "des salariés interrogés en France ont ressenti beaucoup de stress une grande partie de la veille.",
        "source": "Gallup · State of the Global Workplace 2026",
        "sourceUrl": "https://www.gallup.com/workplace/705338/state-global-workplace-france-country-level-data.aspx",
        "year": "2026",
        "note": "France · moyenne glissante 2023–2025. Le stress n’est pas nécessairement lié au travail.",
        "verified": true,
        "group": "people"
      },
      {
        "id": "stat-detresse",
        "value": "1 sur 2",
        "label": "salarié présente un signe de détresse psychologique.",
        "source": "Empreinte Humaine / Ipsos bva · juin 2026",
        "sourceUrl": "https://empreintehumaine.com/aef-info-la-moitie-des-salaries-francais-presente-un-signe-de-detresse-psychologique-empreinte-humaine/",
        "year": "2026",
        "note": "Salariés français interrogés. Un signe de détresse n’est pas un diagnostic médical.",
        "verified": true,
        "group": "people"
      },
      {
        "id": "stat-engagement",
        "value": "8 %",
        "label": "des salariés interrogés en France sont engagés au travail ; 20 % sont activement désengagés.",
        "source": "Gallup · State of the Global Workplace 2026",
        "sourceUrl": "https://www.gallup.com/workplace/705338/state-global-workplace-france-country-level-data.aspx",
        "year": "2026",
        "note": "France · moyennes glissantes 2023–2025. L’engagement est mesuré selon la méthode Gallup.",
        "verified": true,
        "group": "people"
      },
      {
        "id": "stat-absenteisme-2026",
        "value": "4,95 %",
        "label": "le taux d’absentéisme en 2025 dans le secteur privé étudié par WTW.",
        "source": "WTW · Baromètre absentéisme du secteur privé 2026",
        "sourceUrl": "https://www.wtwco.com/fr-fr/news/2026/10/barometre-absenteisme-prive-2026",
        "year": "2026",
        "note": "Données 2025 · 3 100 sociétés, représentant 427 800 salariés en équivalent temps plein. Publication du 6 octobre 2026.",
        "verified": true,
        "group": "cost"
      },
      {
        "id": "stat-duree-2026",
        "value": "38 jours",
        "label": "la durée moyenne d’absence en 2025 selon WTW.",
        "source": "WTW · Baromètre absentéisme du secteur privé 2026",
        "sourceUrl": "https://www.wtwco.com/fr-fr/news/2026/10/barometre-absenteisme-prive-2026",
        "year": "2026",
        "note": "Données 2025 · secteur privé étudié. La source parle de durée moyenne d’absence ; ce chiffre n’est pas présenté comme une durée par arrêt.",
        "verified": true,
        "group": "cost"
      },
      {
        "id": "stat-pib",
        "value": "9 %",
        "label": "du PIB mondial : environ 10 000 milliards de dollars de productivité perdue à cause du faible engagement.",
        "source": "Gallup · State of the Global Workplace 2026",
        "sourceUrl": "https://www.gallup.com/workplace/349484/state-of-the-global-workplace.aspx",
        "year": "2026",
        "note": "Estimation mondiale pour 2025 ; elle ne mesure pas le coût du désengagement dans une entreprise particulière.",
        "verified": true,
        "group": "cost"
      }
    ],
    "diagnostic": {
      "title": "Diagnostiquer et sécuriser",
      "text": "Voir ce qui se joue avant d’agir. Un diagnostic des risques psychosociaux, utile à votre document unique (DUERP), pour lire les risques et les ressources de votre organisation avec justesse et décider sur une base claire.",
      "cta": {
        "label": "Découvrir le diagnostic",
        "href": "/diagnostic-rps/"
      }
    },
    "reasonsTitle": "Pourquoi choisir Calas Conseil",
    "reasons": [
      {
        "title": "Un binôme qui conjugue finesse d’analyse humaine et connaissance de l’entreprise.",
        "text": "Sara Serrano Cabeza a été DRH et chef d’entreprise : elle connaît les enjeux stratégiques, les contraintes du terrain et l’exigence de résultat. Dix ans d’accompagnement en institution, auprès des situations humaines les plus complexes, ont affûté son observation et son analyse des comportements. Agnès Loupias, psychologue clinicienne, apporte une compréhension profonde des mécanismes psychiques et de ce qui se joue dans les relations."
      },
      {
        "title": "De la stratégie aux outils",
        "text": "Notre sens stratégique et notre lecture approfondie des comportements humains nous permettent de concevoir nos propres outils, comme La Boussole émotionnelle, au plus près de vos enjeux."
      },
      {
        "title": "Un même regard sur l’humain, du diagnostic à l’action.",
        "text": "Les associées sont vos interlocutrices et vos intervenantes du diagnostic au terrain."
      }
    ],
    "domainsTitle": "Notre chemin en trois temps",
    "domainsIntro": "Du diagnostic à la transformation managériale.",
    "conviction": {
      "title": "Notre conviction",
      "text": "Une organisation tient par ses process, et plus encore par la qualité des liens entre les personnes qui la font vivre.\n\nChacun arrive au travail avec ses émotions qui expriment ce qui compte pour lui et font écho à ses valeurs, à ses aspirations et à ses croyances qui influencent sa manière de percevoir les situations et d’entrer en relation avec les autres. Émotions et croyances façonnent ainsi nos comportements et nos interactions.\n\nCes liens reposent sur l’authenticité, qui permet de parler vrai, et un cadre de sécurité, qui permet d’oser. Ils s’apprennent et s’entretiennent, par des rituels de conversation et des temps de régulation.",
      "closingQuote": "Quand on se sent en sécurité, on ose : c’est là que naît l’autonomie.",
      "cta": {
        "label": "Découvrir notre approche",
        "href": "/notre-approche/"
      }
    },
    "closingTitle": "Parlons de vos priorités.",
    "closingCta": {
      "label": "Échanger sur vos priorités",
      "href": "/contact/"
    },
    "seo": {
      "title": "Calas Conseil — Performance durable et qualité du lien",
      "description": "Calas Conseil relie prévention des RPS, compétences relationnelles et accompagnement des managers pour construire une performance durable par la qualité du lien."
    },
    "editorial": {
      "heroAudience": "Aux côtés des dirigeants, des RH,\ndes managers et des CSE.",
      "heroDisciplines": [
        "Diagnostic",
        "Compétences relationnelles",
        "Management"
      ],
      "heroArtTop": "LA QUALITÉ DU LIEN",
      "heroArtBottom": "UNE PERFORMANCE DURABLE",
      "heroArtCaption": "La voie de la\nqualité relationnelle.",
      "exploreLabel": "Explorer notre démarche",
      "statisticsEyebrow": "Quelques repères",
      "statisticsDescription": "Ce que vivent les équipes, et les conséquences pour les organisations.",
      "statisticsNote": "Des périmètres distincts : chaque donnée est accompagnée de sa source et de sa période d’observation.",
      "diagnosticEyebrow": "Diagnostic & prévention des RPS",
      "diagnosticArtEyebrow": "Comprendre ce qui se joue",
      "diagnosticArtLegend": [
        "Organisation",
        "Relations",
        "Personnes"
      ],
      "diagnosticArtTitle": "Relier les signaux.\nFaire émerger le sens.",
      "diagnosticNote": "L’évaluation des RPS fait partie des obligations de prévention de l’employeur. Nous vous aidons à structurer cette démarche.",
      "reasonsEyebrow": "Pourquoi choisir Calas Conseil",
      "reasonsLink": {
        "label": "Rencontrer Sara & Agnès",
        "href": "/qui-sommes-nous/"
      },
      "reasonsMotifLabel": "Le lien",
      "domainsEyebrow": "Notre chemin en trois temps",
      "convictionEyebrow": "Notre conviction"
    },
    "whyNow": {
      "title": "Pourquoi maintenant",
      "text": "Dans un monde en pleine mutation, où les repères changent, chacun cherche ce qui donne sens et stabilité. Les besoins matériels assurent la base ; les besoins existentiels, eux, donnent l’élan : exister, appartenir et grandir. Ils nourrissent le sens du travail et libèrent les ressources de chacun, son énergie, sa créativité, son envie de s’engager. Et cela se construit dans la relation. C’est pourquoi la qualité du lien devient aujourd’hui un levier décisif pour les personnes comme pour l’entreprise."
    },
    "journey": {
      "cards": [
        {
          "key": "diagnostic",
          "eyebrow": "Le socle",
          "title": "Diagnostiquer et sécuriser",
          "lead": "Voir ce qui se joue avant d’agir.",
          "text": "Un diagnostic des risques psychosociaux, utile à votre document unique (DUERP), pour lire les risques et les ressources de votre organisation avec justesse et décider sur une base claire.",
          "cta": {
            "label": "Découvrir le diagnostic",
            "href": "/diagnostic-rps/"
          }
        },
        {
          "key": "equipes",
          "eyebrow": "L’action au quotidien",
          "title": "Outiller et réguler",
          "lead": "Développer des compétences relationnelles.",
          "text": "Des processus d’apprentissage, conférences et ateliers, sur les émotions et les croyances pour mieux se comprendre, ajuster son comportement au sein du collectif et agir en conscience dans la relation.",
          "cta": {
            "label": "Développer les compétences relationnelles",
            "href": "/equipes/"
          }
        },
        {
          "key": "managers",
          "eyebrow": "L’ancrage dans la durée",
          "title": "Transformer et pérenniser",
          "lead": "Faire du manager un professionnel du lien.",
          "text": "Un parcours sur la posture, pour que chaque manager devienne un point d’appui pour son équipe.",
          "cta": {
            "label": "Accompagner les managers",
            "href": "/managers/"
          }
        }
      ],
      "transition": "Chaque étape a sa valeur propre, et toutes s’enchaînent.",
      "sensitiveText": "Et quand une situation se tend (conflit, événement difficile, personne en difficulté), nous intervenons rapidement.",
      "sensitiveCta": {
        "label": "Accompagner les situations sensibles",
        "href": "/situations-sensibles/"
      }
    }
  },
  "pages": [
    {
      "id": "page-contact",
      "slug": "contact",
      "eyebrow": "Le premier pas",
      "title": "Et si nous prenions\nle temps d’en parler ?",
      "intro": "Un premier échange pour comprendre votre situation et envisager la suite, ensemble.",
      "sections": [],
      "seo": {
        "title": "Échangeons sur votre situation | Calas Conseil",
        "description": "Échangez avec Calas Conseil sur vos priorités : diagnostic RPS, compétences relationnelles, accompagnement des managers ou situations sensibles."
      },
      "contact": {
        "formEyebrow": "Nous écrire",
        "formTitle": "Votre situation,\nen quelques mots.",
        "directHeading": "Vous préférez un contact direct ?",
        "context": "Diagnostic RPS, compétences relationnelles, management ou situation sensible : choisissez l’objet qui se rapproche le plus de votre situation.",
        "linkedinLabel": "Retrouvons-nous sur LinkedIn"
      }
    },
    {
      "id": "page-reflexions",
      "slug": "reflexions",
      "eyebrow": "Prendre du recul",
      "title": "Réflexions",
      "intro": "Le travail, les relations, le rôle du manager. Un espace pour prolonger la réflexion sur ce qui fait tenir un collectif.",
      "sections": [],
      "seo": {
        "title": "Réflexions sur le travail et la qualité du lien | Calas Conseil"
      },
      "journal": {
        "baseline": "Le carnet de Calas Conseil",
        "topics": "Travail · Relations · Management",
        "seriesEyebrow": "Notre première série",
        "seriesStatus": "À paraître",
        "seriesTitle": "Le manager comme\nprofessionnel du lien.",
        "seriesText": "Cette première série ouvrira notre espace de publications. Un prolongement de la conviction qui guide Calas Conseil : le lien est une compétence qui s’apprend et se développe.",
        "seriesCta": {
          "label": "Découvrir notre conviction",
          "href": "/notre-approche/"
        },
        "exploreEyebrow": "Pour poursuivre",
        "exploreTitle": "De la réflexion\nà votre réalité."
      }
    },
    {
      "id": "page-diagnostic",
      "slug": "diagnostic-rps",
      "eyebrow": "Diagnostic & prévention des RPS",
      "title": "Voir clair avant d’agir",
      "intro": "Les signaux qu’envoie une organisation ont toujours un sens. Avant d’agir, il est essentiel de comprendre où ils prennent racine : dans l’organisation du travail, dans les relations, ou dans ce que vivent les personnes. Notre diagnostic vous donne cette lecture, et vous aide à décider par où commencer.",
      "cta": {
        "label": "Parlons de votre diagnostic",
        "href": "/contact/?objet=diagnostic"
      },
      "seo": {
        "title": "Diagnostic RPS, DUERP et prévention — IPRP | Calas Conseil",
        "description": "Un diagnostic des risques psychosociaux, une démarche en cinq étapes et un double regard IPRP et psychologie clinique pour construire des priorités d’action utiles au DUERP."
      },
      "sections": [
        {
          "key": "signaux",
          "title": "Quand nous solliciter",
          "text": "",
          "kind": "list",
          "presentation": "default",
          "items": [
            {
              "title": "Des difficultés qui se répètent",
              "text": "Leurs causes restent floues."
            },
            {
              "title": "Des signaux en hausse",
              "text": "Les arrêts, les départs ou les conflits augmentent."
            },
            {
              "title": "Une évaluation à structurer",
              "text": "Vous devez évaluer les risques psychosociaux dans votre document unique."
            },
            {
              "title": "Des changements qui fragilisent",
              "text": "Une réorganisation, une fusion ou une croissance rapide fragilise les équipes."
            }
          ],
          "navigationLabel": "Quand nous solliciter"
        },
        {
          "key": "facteurs",
          "title": "Ce que nous analysons",
          "text": "Les six familles de facteurs de risques psychosociaux reconnues par l’INRS (rapport Gollac) : l’intensité et le temps de travail, les exigences émotionnelles, l’autonomie, les rapports sociaux au travail, les conflits de valeurs et l’insécurité de la situation de travail.",
          "kind": "text",
          "presentation": "default",
          "navigationLabel": "Les facteurs de risque"
        },
        {
          "key": "etapes",
          "title": "Notre démarche, en cinq étapes",
          "text": "",
          "kind": "steps",
          "presentation": "method",
          "items": [
            {
              "title": "Cadrer",
              "text": "Vos enjeux, le périmètre, les acteurs associés (direction, RH, CSE)."
            },
            {
              "title": "Écouter",
              "text": "Les indicateurs RH et la parole des personnes sur leur travail."
            },
            {
              "title": "Analyser",
              "text": "Les facteurs de risque, mais aussi les ressources sur lesquelles s’appuyer."
            },
            {
              "title": "Restituer",
              "text": "Une lecture partagée, claire et hiérarchisée."
            },
            {
              "title": "Construire la suite",
              "text": "Un plan d’action concret, sur l’organisation comme sur les relations."
            }
          ],
          "navigationLabel": "La démarche",
          "instruction": "Explorez les étapes de la démarche."
        },
        {
          "key": "methodes",
          "title": "Nos méthodes",
          "text": "Choisies après le cadrage selon votre contexte : analyse des indicateurs RH, entretiens individuels ou collectifs, observation du travail, questionnaire lorsque c’est utile, groupes de travail pour construire les actions.",
          "kind": "text",
          "presentation": "default"
        },
        {
          "key": "regards",
          "title": "Ce qui fait la différence",
          "text": "",
          "kind": "split",
          "presentation": "default",
          "items": [
            {
              "title": "Un double regard",
              "text": "Une ancienne DRH, IPRP enregistrée auprès de la DREETS, et une psychologue clinicienne : l’organisation et la personne, lues ensemble."
            },
            {
              "title": "Un diagnostic qui mène à l’action",
              "text": "Des priorités concrètes et un accompagnement possible pour les mettre en œuvre."
            },
            {
              "title": "Le lien au cœur de l’analyse",
              "text": "La qualité des relations touche directement plusieurs familles de risques : exigences émotionnelles, autonomie, rapports sociaux au travail. C’est souvent là que se trouve la racine."
            }
          ],
          "navigationLabel": "Le double regard"
        },
        {
          "key": "livrables",
          "title": "Ce que vous obtenez",
          "text": "",
          "kind": "list",
          "presentation": "deliverables",
          "items": [
            {
              "title": "Une note de cadrage",
              "text": "Le périmètre et le cadre de la démarche."
            },
            {
              "title": "Une synthèse claire",
              "text": "Une lecture partagée des constats."
            },
            {
              "title": "Une cartographie",
              "text": "Les facteurs de risque et les ressources."
            },
            {
              "title": "Une restitution",
              "text": "À la direction et aux instances prévues."
            },
            {
              "title": "Un plan d’action coconstruit",
              "text": "Des priorités concrètes pour agir."
            },
            {
              "title": "Des éléments pour votre document unique",
              "text": "Un appui à l’évaluation des risques psychosociaux."
            }
          ],
          "navigationLabel": "Les livrables"
        },
        {
          "key": "confiance",
          "kind": "notice",
          "title": "La confiance se prépare\navant la première écoute.",
          "text": "Confidentialité, restitution collective et règles de partage sont précisées avant chaque mission. Ces modalités tiennent compte de la taille de l’équipe et de la situation. Un anonymat absolu ne peut pas être promis dans tous les contextes, notamment dans un petit collectif.",
          "presentation": "default"
        },
        {
          "key": "questions",
          "kind": "list",
          "eyebrow": "Avant de commencer",
          "title": "Vos premières\nquestions.",
          "items": [
            {
              "title": "Faut-il attendre qu’un conflit éclate ?",
              "text": "Vous pouvez nous solliciter dès que des tensions se répètent, que les signaux deviennent difficiles à interpréter ou que vous souhaitez structurer votre évaluation des RPS. L’objet du premier échange est de comprendre votre situation et la demande."
            },
            {
              "title": "Qui participe à la démarche ?",
              "text": "La demande peut venir de la direction, des RH ou du CSE. Le périmètre, les personnes associées, les modalités d’écoute et les destinataires de la restitution sont précisés lors du cadrage, en fonction de la situation."
            },
            {
              "title": "Le diagnostic engage-t-il un accompagnement ensuite ?",
              "text": "Le diagnostic et les autres accompagnements sont des domaines autonomes. Vous pouvez choisir le diagnostic seul. Ses conclusions permettent de discuter la suite et, si vous le souhaitez, d’en définir le périmètre dans une proposition distincte."
            }
          ],
          "presentation": "faq",
          "navigationLabel": "Vos questions"
        },
        {
          "key": "prevention",
          "kind": "text",
          "title": "Un appui à votre démarche\nde prévention.",
          "text": "L’évaluation des RPS fait partie des obligations de prévention de l’employeur. Notre accompagnement aide à structurer cette démarche ; le recours à un diagnostic externe n’est pas une obligation en soi.\n\nLe diagnostic fournit des repères pour agir. Ses conclusions se discutent dans le cadre défini avec vous, puis servent à préciser les suites de la démarche.",
          "presentation": "default"
        }
      ],
      "offerExcerpt": "Voir ce qui se joue avant d’agir. Un diagnostic des risques psychosociaux, utile à votre document unique (DUERP), pour lire les risques et les ressources de votre organisation avec justesse et décider sur une base claire.",
      "editorial": {
        "artTop": "LIRE LE TRAVAIL AUTREMENT",
        "artBottom": "ORGANISATION · MANAGEMENT · RELATIONS",
        "methodLinkLabel": "Explorer la démarche",
        "invitationEyebrow": "Et maintenant ?",
        "invitationTitle": "Commençons par\nvotre situation."
      }
    },
    {
      "id": "page-equipes",
      "slug": "equipes",
      "eyebrow": "Développement des compétences relationnelles",
      "title": "Développer ses compétences relationnelles",
      "intro": "Comprendre ce qui se joue en soi pour mieux agir avec les autres : une capacité qui se développe pas à pas, au contact des situations réelles. Nos formats vont de la sensibilisation à de véritables processus d’apprentissage.",
      "cta": {
        "label": "Trouver le format pour votre équipe",
        "href": "/contact/?objet=equipes"
      },
      "sections": [
        {
          "key": "formats",
          "title": "Trois formats pour apprendre et agir",
          "text": "",
          "kind": "list",
          "presentation": "default",
          "items": [
            {
              "title": "La conférence « Stress et émotions au travail : du signal à l’action »",
              "text": "Une première rencontre, pour toute une équipe ou un collectif de managers. Comprendre ce que le stress et les émotions disent de nos besoins, et comment en faire un levier plutôt qu’un obstacle. Environ 1 h 30. Une action de sensibilisation que vous pouvez inscrire dans le plan de prévention de votre document unique (DUERP)."
            },
            {
              "title": "La Boussole émotionnelle : un processus d’apprentissage",
              "text": "Des ateliers expérientiels en petit groupe, chacun centré sur une émotion : la colère (de la tension à l’affirmation), puis la peur (de l’inquiétude au courage). Chaque participant apprend à reconnaître ce qu’il ressent, à vérifier son interprétation et à choisir sa réponse, avec des défis concrets à tester entre les séances."
            },
            {
              "title": "Le Décodeur des croyances — bientôt disponible",
              "text": "Un atelier pour rendre visibles les croyances qui orientent nos réactions et celles d’un collectif, et ouvrir d’autres possibilités d’action."
            }
          ],
          "navigationLabel": "Nos formats"
        },
        {
          "key": "ingenierie",
          "title": "Notre ingénierie pédagogique",
          "text": "Nos outils sont conçus par nous, à partir des sciences humaines (psychologie, analyse transactionnelle, sciences du comportement) et de ce que nous avons observé sur le terrain, au plus près des équipes : par exemple les cartes Miroirs des émotions, et une progression par la découverte. La relation s’apprend en l’expérimentant.",
          "kind": "notice",
          "presentation": "default",
          "navigationLabel": "Nos outils"
        },
        {
          "key": "cadre",
          "title": "Un cadre professionnel",
          "text": "Un cadre professionnel, centré sur les situations de travail, qui complète les actions sur l’organisation sans les remplacer.",
          "kind": "text",
          "presentation": "default"
        }
      ],
      "seo": {
        "title": "Formation et compétences relationnelles — Stress et émotions | Calas Conseil",
        "description": "Conférence Stress et émotions au travail, La Boussole émotionnelle et ateliers : développer les compétences relationnelles au contact des situations réelles."
      },
      "offerExcerpt": "Développer ses compétences relationnelles. Des processus d’apprentissage, conférences et ateliers, sur les émotions et les croyances pour mieux se comprendre, ajuster son comportement au sein du collectif et agir en conscience dans la relation.",
      "editorial": {
        "artTop": "LIRE LE TRAVAIL AUTREMENT",
        "artBottom": "ORGANISATION · MANAGEMENT · RELATIONS",
        "invitationEyebrow": "Et maintenant ?",
        "invitationTitle": "Commençons par\nvotre situation."
      },
      "format": {
        "delivery": "Conférences et ateliers expérientiels en petit groupe"
      }
    },
    {
      "id": "page-managers",
      "slug": "managers",
      "eyebrow": "Managers & dirigeants",
      "title": "Faire du manager un professionnel du lien",
      "intro": "Le manager est le trait d’union entre la stratégie de la direction et le quotidien des équipes : c’est par lui que la stratégie humaine devient réalité. Le parcours Le manager, professionnel du lien fait du management un véritable métier, construit cycle après cycle : soi, la relation, le système.",
      "cta": {
        "label": "Échanger sur vos enjeux managériaux",
        "href": "/contact/?objet=managers"
      },
      "sections": [
        {
          "key": "role",
          "title": "Le rôle du manager dans l’engagement",
          "text": "Selon Gallup, les managers expliquent 70 % des écarts d’engagement entre équipes. Ce chiffre porte sur la variation des scores d’engagement entre équipes, pas sur la part d’engagement de chaque salarié.",
          "kind": "text",
          "presentation": "default",
          "body": {
            "type": "doc",
            "content": [
              {
                "type": "paragraph",
                "content": [
                  {
                    "type": "text",
                    "text": "Source : Gallup, managers et engagement des équipes.",
                    "marks": [
                      {
                        "type": "link",
                        "attrs": {
                          "href": "https://www.gallup.com/workplace/713033/managers-and-team-productivity.aspx"
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        },
        {
          "key": "capacites",
          "title": "Sept capacités au cœur du parcours",
          "text": "Lucidité systémique, stabilité intérieure, intégrité relationnelle, discernement, courage managérial, coopération consciente, posture apprenante.",
          "kind": "text",
          "presentation": "default",
          "navigationLabel": "Les capacités"
        },
        {
          "key": "cycles",
          "title": "Trois phases qui construisent, pas à pas, une culture du lien et une performance durable",
          "text": "",
          "kind": "steps",
          "presentation": "default",
          "items": [
            {
              "title": "Fondation : soi",
              "text": "Se connaître pour manager autrement : gagner en présence, en lucidité et en stabilité intérieure."
            },
            {
              "title": "Régulation du lien : la relation",
              "text": "Reconnaître, nourrir et réguler les relations dans l’équipe, pour un climat où chacun se sent vu et s’engage."
            },
            {
              "title": "Ancrage et autonomie : le système",
              "text": "Ancrer les changements dans les rituels et les décisions, partager ce qui a été appris : le manager devient une ressource pour toute l’organisation."
            }
          ],
          "navigationLabel": "Les trois phases"
        },
        {
          "key": "rythme",
          "title": "Un rythme connecté au terrain",
          "text": "Chaque mois, une journée de séminaire, une supervision collective de deux heures et un rituel à expérimenter avec son équipe. Une communauté d’apprentissage entre managers et un accompagnement individuel soutiennent la mise en pratique.",
          "kind": "text",
          "presentation": "default",
          "navigationLabel": "Le rythme"
        },
        {
          "key": "changements",
          "title": "Ce qui change",
          "text": "Des managers qui clarifient, soutiennent et font grandir ; des désaccords qui se travaillent ouvertement ; une équipe qui gagne en autonomie. Peu à peu, c’est la culture de l’organisation qui évolue. Les effets se suivent dans le temps : enquête de climat avant et après le parcours, suivi de l’absentéisme et du turnover, auto-évaluation des managers.",
          "kind": "text",
          "presentation": "default"
        },
        {
          "key": "dirigeant",
          "title": "Le dirigeant, premier porteur de la transformation",
          "text": "Un accompagnement individuel tout au long du parcours, du cadrage jusqu’à son achèvement, pour aligner sa posture, ses décisions et la stratégie humaine de l’entreprise. La culture d’une organisation se transforme d’abord à son sommet.",
          "kind": "notice",
          "presentation": "default",
          "navigationLabel": "Le dirigeant"
        }
      ],
      "seo": {
        "title": "Accompagnement des managers — Le manager professionnel du lien | Calas Conseil",
        "description": "Un parcours pour les managers et dirigeants : soi, la relation, le système. Faire évoluer la posture, les pratiques et la culture du lien dans l’organisation."
      },
      "offerExcerpt": "Faire du manager un professionnel du lien. Un parcours sur la posture, pour que chaque manager devienne un point d’appui pour son équipe.",
      "editorial": {
        "artTop": "LIRE LE TRAVAIL AUTREMENT",
        "artBottom": "ORGANISATION · MANAGEMENT · RELATIONS",
        "invitationEyebrow": "Et maintenant ?",
        "invitationTitle": "Commençons par\nvotre situation."
      },
      "format": {
        "rhythm": "Chaque mois : une journée de séminaire et deux heures de supervision collective.",
        "delivery": "Séminaires, communauté d’apprentissage, accompagnement individuel et expérimentation avec l’équipe."
      }
    },
    {
      "id": "page-situations-sensibles",
      "slug": "situations-sensibles",
      "eyebrow": "Accompagner les situations sensibles",
      "title": "Quand la relation se tend, agir vite et juste",
      "intro": "Un conflit qui s’enlise, un événement qui ébranle une équipe, une personne en difficulté : certaines situations ne peuvent pas attendre un plan d’action. Notre binôme intervient avec la rigueur de l’entreprise et la finesse de la clinique, pour apaiser, comprendre et remettre le collectif en mouvement.",
      "cta": {
        "label": "Échanger sur votre situation",
        "href": "/contact/?objet=sensible"
      },
      "offerExcerpt": "Conflit, événement difficile, personne en difficulté : retrouver des repères et remettre le collectif en mouvement.",
      "seo": {
        "title": "Situations sensibles — Régulation de conflits au travail | Calas Conseil",
        "description": "Régulation de conflits, soutien après un événement difficile, groupes de parole, analyse de la pratique et accompagnement individuel dans un cadre professionnel."
      },
      "editorial": {
        "artTop": "RETROUVER LE DIALOGUE",
        "artBottom": "ÉCOUTER · COMPRENDRE · AGIR",
        "invitationEyebrow": "Parlons de votre situation",
        "invitationTitle": "Retrouver des repères, ensemble."
      },
      "sections": [
        {
          "key": "formats",
          "title": "Cinq formats pour répondre à votre situation",
          "text": "",
          "kind": "list",
          "presentation": "default",
          "items": [
            {
              "title": "Régulation de conflits",
              "text": "Un tiers extérieur pour renouer le dialogue entre deux personnes ou au sein d’une équipe : entretiens individuels, puis temps d’échange cadré pour clarifier les attentes et construire des accords concrets."
            },
            {
              "title": "Soutien après un événement difficile",
              "text": "Agression, accident, décès, annonce brutale d’une réorganisation : une intervention auprès des équipes et de l’encadrement, pour accueillir ce qui est vécu, limiter les effets dans la durée et aider la direction à communiquer juste."
            },
            {
              "title": "Groupes de parole",
              "text": "Des temps réguliers et confidentiels où une équipe peut mettre des mots sur ce qu’elle vit au travail, particulièrement dans les métiers exposés à de fortes exigences émotionnelles (soin, social, relation au public)."
            },
            {
              "title": "Analyse de la pratique",
              "text": "Pour les managers et les professionnels de l’accompagnement : prendre du recul sur des situations réelles, entre pairs, pour ajuster sa posture et ne pas rester seul face à la complexité."
            },
            {
              "title": "Accompagnement individuel",
              "text": "Pour un manager isolé, un collaborateur fragilisé ou un retour après une absence : quelques séances centrées sur la situation de travail, pour retrouver des repères et de la marge de manœuvre. Si un suivi de santé est nécessaire, nous orientons vers le médecin du travail ou un professionnel de santé."
            }
          ],
          "navigationLabel": "Les formats"
        },
        {
          "key": "binome",
          "title": "Ce qui fait la différence",
          "text": "Agnès Loupias, psychologue clinicienne, et Sara Serrano Cabeza, praticienne en analyse transactionnelle, ancienne DRH et IPRP enregistrée auprès de la DREETS, toutes deux formées à intervenir en situation de crise. L’une apporte la lecture clinique, l’autre la connaissance des contraintes de l’organisation. Confidentialité et cadre clair posés dès le départ.",
          "kind": "split",
          "presentation": "default",
          "navigationLabel": "Le binôme"
        },
        {
          "key": "cadre",
          "title": "Cadre et limites",
          "text": "Le numéro de Calas Conseil ne remplace pas les numéros d’urgence officiels.",
          "kind": "notice",
          "presentation": "default",
          "items": [
            {
              "title": "Clarifier la demande",
              "text": "La demande, les personnes concernées et les règles de confidentialité sont clarifiées avant toute intervention."
            },
            {
              "title": "Orienter vers les soins adaptés",
              "text": "En cas de danger immédiat, de risque suicidaire ou de besoin de soin, nous orientons vers les urgences, le médecin du travail ou le professionnel de santé compétent."
            },
            {
              "title": "Préserver les confidences individuelles",
              "text": "Ce que nous restituons à l’organisation porte sur le travail, jamais sur les confidences individuelles."
            }
          ],
          "navigationLabel": "Le cadre"
        }
      ]
    },
    {
      "id": "page-approche",
      "slug": "notre-approche",
      "eyebrow": "Notre conviction",
      "title": "Le lien ne se décrète pas.\nIl se construit dans l’altérité.",
      "intro": "Exister, appartenir, grandir. Comprendre ce qui nous met en mouvement et créer les conditions d’une relation authentique, sûre et autonome.",
      "cta": {
        "label": "Échanger sur vos priorités",
        "href": "/contact/"
      },
      "sections": [
        {
          "key": "besoins",
          "title": "Ce qui fait agir une personne au travail.",
          "text": "Chacun porte trois besoins existentiels : exister, être reconnu pour ce que l’on est et pour ce que l’on apporte ; appartenir, avoir sa place dans un collectif ; grandir, apprendre et déployer ses capacités. Ces besoins sont le moteur intime de l’engagement : lorsqu’ils sont nourris, l’énergie vient de l’intérieur et chacun donne le meilleur de lui-même. Lorsqu’ils sont contrariés, la personne se protège, par le retrait, le conflit ou le départ : autant de réactions qui signalent un besoin en souffrance, bien plus qu’un manque de volonté. Les recherches en psychologie du travail convergent sur ce point : la reconnaissance, la qualité des relations et l’autonomie comptent parmi les premiers leviers de l’engagement et de la santé.",
          "kind": "text",
          "presentation": "default",
          "navigationLabel": "Nos besoins"
        },
        {
          "key": "mecanismes",
          "title": "Deux mécanismes qui pilotent nos comportements.",
          "text": "Toute situation passe par le filtre de nos croyances, forgées au fil de notre histoire, qui lui donnent un sens. Ce sens fait naître une émotion, et l’émotion nous met en mouvement. Ces croyances nous ont souvent protégés, un jour ; au travail, certaines continuent d’orienter nos réactions à notre insu. Dans une équipe, des croyances partagées dessinent aussi un cadre implicite : ce qui se dit, ce qui se tait, ce que l’on ose. Mettre ces mécanismes en lumière, c’est passer de la réaction automatique au choix conscient, pour chacun comme pour le collectif.",
          "kind": "text",
          "presentation": "default",
          "navigationLabel": "Nos mécanismes"
        },
        {
          "key": "conditions",
          "title": "Deux conditions qui se renforcent : l’authenticité et la sécurité psychologique.",
          "text": "L’authenticité a besoin d’un cadre sûr pour s’exprimer ; la sécurité prend tout son sens quand chacun ose être vrai.",
          "kind": "split",
          "presentation": "default",
          "items": [
            {
              "title": "L’authenticité",
              "text": "Être en accord entre ce que l’on ressent, ce que l’on pense et ce que l’on exprime. Au travail, c’est dire ce qui est, poser une limite, exprimer un désaccord en préservant la relation. Carl Rogers parlait de congruence : c’est sur elle que se fonde la confiance."
            },
            {
              "title": "La sécurité psychologique",
              "text": "La conviction partagée, dans une équipe, que l’on peut poser une question, signaler une erreur ou proposer une idée en toute confiance. Elle se construit par un cadre clair, un manager qui soutient et des règles d’échange respectées. Elle libère l’initiative, l’apprentissage et les ressources de chacun."
            }
          ],
          "navigationLabel": "Authenticité et sécurité"
        },
        {
          "key": "recherche",
          "title": "Ce que dit la recherche.",
          "text": "Les travaux de Jane Dutton (Université du Michigan) décrivent quatre leviers des relations de qualité au travail : l’engagement respectueux, l’aide à la réussite de l’autre, la confiance et les moments partagés. Tous reposent sur nos deux conditions : l’authenticité ouvre la confiance et l’engagement ; la sécurité permet de demander et d’offrir de l’aide. Amy Edmondson (Harvard) le confirme : une équipe qui se sent en sécurité ose parler, apprend et gagne en performance.",
          "kind": "text",
          "presentation": "default"
        },
        {
          "key": "autonomie",
          "title": "Un résultat : l’autonomie.",
          "text": "Être autonome, c’est agir en accord avec soi-même tout en restant relié aux autres. Dans une équipe, cela se voit concrètement : des initiatives prises, une coopération d’adulte à adulte, un engagement qui dure. L’analyse transactionnelle décrit cette autonomie par trois capacités : la conscience de soi, la spontanéité et la relation vraie.",
          "kind": "text",
          "presentation": "default",
          "navigationLabel": "L’autonomie"
        },
        {
          "key": "parti-pris",
          "title": "Notre parti pris : professionnaliser le lien.",
          "text": "La qualité relationnelle est une compétence stratégique, qui s’apprend par la connaissance de soi et par l’expérimentation. Une organisation est un système vivant, où se rencontrent des personnes, des histoires et des regards différents : le lien s’y cultive, s’y régule au quotidien et se pilote comme toute autre dimension de l’organisation. C’est en mettant à l’épreuve du réel ce que l’on découvre de soi que les nouveaux comportements s’ancrent durablement.",
          "kind": "text",
          "presentation": "default"
        },
        {
          "key": "appuis",
          "title": "Nos appuis",
          "text": "Analyse transactionnelle ; recherche sur le lien et la sécurité au travail (le responsable comme base de sécurité, la sécurité psychologique, le soutien à l’autonomie) ; références françaises de prévention (rapport Gollac, ANACT).",
          "kind": "notice",
          "presentation": "default"
        }
      ],
      "seo": {
        "title": "Notre approche — Le lien se construit dans l’altérité | Calas Conseil",
        "description": "Authenticité, sécurité psychologique et autonomie : l’approche de Calas Conseil pour faire de la qualité relationnelle une compétence stratégique."
      },
      "editorial": {
        "artTop": "LA QUALITÉ DU LIEN",
        "artBottom": "ORGANISATION · MANAGEMENT · RELATIONS",
        "invitationEyebrow": "Et maintenant ?",
        "invitationTitle": "Commençons par\nvotre situation."
      }
    },
    {
      "id": "page-nous",
      "slug": "qui-sommes-nous",
      "eyebrow": "Calas Conseil",
      "title": "Deux parcours.\nUn même regard sur le lien.",
      "intro": "Un binôme qui conjugue finesse d’analyse humaine et connaissance de l’entreprise. Les associées sont vos interlocutrices et vos intervenantes du diagnostic au terrain.",
      "cta": {
        "label": "Faire connaissance",
        "href": "/contact/"
      },
      "sections": [
        {
          "key": "binome",
          "title": "Un même regard sur l’humain, du diagnostic à l’action.",
          "text": "Notre sens stratégique et notre lecture approfondie des comportements humains nous permettent de concevoir nos propres outils, comme La Boussole émotionnelle, au plus près de vos enjeux.",
          "kind": "text",
          "presentation": "default"
        }
      ],
      "seo": {
        "title": "Sara Serrano Cabeza et Agnès Loupias | Calas Conseil",
        "description": "Un binôme complémentaire au croisement de la direction RH et de la psychologie clinique, pour lire les situations de travail dans leur ensemble."
      },
      "editorial": {
        "artTop": "LA QUALITÉ DU LIEN",
        "artBottom": "ORGANISATION · MANAGEMENT · RELATIONS",
        "invitationEyebrow": "Et maintenant ?",
        "invitationTitle": "Commençons par\nvotre situation."
      }
    },
    {
      "id": "page-legal",
      "slug": "mentions-legales",
      "eyebrow": "Informations du site",
      "title": "Mentions légales",
      "intro": "Calas Conseil — La voie de la qualité relationnelle.",
      "sections": [
        {
          "key": "contact",
          "kind": "text",
          "title": "Nous joindre",
          "text": "Pour toute question concernant ce site : saraserranocabeza@gmail.com ou 06 43 16 83 81.",
          "presentation": "default"
        }
      ]
    },
    {
      "id": "page-privacy",
      "slug": "confidentialite",
      "eyebrow": "Vos données",
      "title": "Confidentialité",
      "intro": "Nous limitons les informations demandées à ce qui est utile pour comprendre votre demande et vous répondre.",
      "sections": [
        {
          "key": "form",
          "kind": "text",
          "title": "Les informations du formulaire",
          "text": "Le formulaire recueille votre nom, votre courriel, l’objet de votre demande et votre message. L’organisation, la fonction et le téléphone sont facultatifs. Une case non précochée permet de confirmer votre accord pour être recontacté au sujet de cette demande, avec un lien vers cette politique de confidentialité. Ces informations servent à traiter votre demande. Merci de ne pas transmettre d’informations médicales ni de données concernant un tiers.",
          "presentation": "default"
        },
        {
          "key": "droits",
          "kind": "text",
          "title": "Vos demandes concernant vos données",
          "text": "Vous pouvez écrire à saraserranocabeza@gmail.com pour toute demande d’accès, de rectification ou d’effacement concernant vos informations. Les modalités applicables sont précisées avec le responsable du traitement.",
          "presentation": "default"
        },
        {
          "key": "traceurs",
          "kind": "text",
          "title": "Une navigation sobre",
          "text": "Ce site n’utilise pas d’outil publicitaire ni de widget social tiers. Les polices sont hébergées avec le site. Un cookie technique est réservé aux personnes autorisées à prévisualiser les contenus.",
          "presentation": "default"
        }
      ]
    }
  ],
  "people": [
    {
      "id": "person-sara",
      "name": "Sara Serrano Cabeza",
      "role": "Consultante en relations humaines et stratégie RH. IPRP, praticienne en analyse transactionnelle.",
      "bio": "Licences de psychologie et d’éducation sociale, Master DRH.\n\nMon parcours croise deux mondes. D’un côté, dix ans d’accompagnement des personnes en institution, qui m’ont appris à observer et comprendre les comportements humains et les interactions sociales dans ce qu’elles ont de plus complexe. Auprès des situations les plus difficiles, j’ai appris ce qui se joue au-delà des comportements visibles. De l’autre, des postes de direction en entreprise, jusqu’à DRH : je connais les exigences, les contraintes et l’objectif de résultat. C’est ce double ancrage qui me permet de relier performance et qualité relationnelle, de la stratégie à la conception des outils, jusqu’à l’animation sur le terrain."
    },
    {
      "id": "person-agnes",
      "name": "Agnès Loupias",
      "role": "Psychologue clinicienne",
      "bio": "Master en psychologie clinique et psychopathologie.\n\nAprès vingt ans d’expérience en entreprise, j’ai choisi une reconversion professionnelle pour devenir psychologue clinicienne. Ce parcours singulier me permet aujourd’hui de conjuguer une connaissance concrète du monde de l’entreprise avec une compréhension fine du fonctionnement humain et des dynamiques relationnelles.\n\nJ’interviens auprès des salariés, notamment dans le cadre d’entretiens individuels et de situations de crise en entreprise. Je conduis également des actions de prévention en santé au travail, en particulier auprès des salariés en fin de carrière. Ces expériences m’ont permis de mieux appréhender les réalités humaines du monde professionnel, les difficultés rencontrées par les personnes et leurs répercussions sur le travail et les collectifs.\n\nAu sein de Calas Conseil, je contribue à éclairer les situations de travail et les relations humaines. Mon approche consiste à dépasser les comportements visibles pour comprendre ce qui se joue, tant au niveau individuel que collectif : les tensions, les difficultés relationnelles, les fragilités et les facteurs qui influencent le bien-être et la coopération au travail. Cette compréhension nourrit notre approche des risques psychosociaux et notre accompagnement des organisations."
    }
  ],
  "articles": linkedinArticles
};
