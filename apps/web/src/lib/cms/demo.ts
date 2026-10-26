import type { SiteContent } from './types';

// Contenu de travail isolé, enrichi depuis le brief et l’ODT. Relecture éditoriale requise avant publication.
// Jamais utilisé comme repli d’une panne de la base de données.
export const demoContent: SiteContent = {
  "settings": {
    "brand": "Calas Conseil",
    "tagline": "La voie de la qualité relationnelle.",
    "phone": "06 43 16 83 81",
    "email": "saraserranocabeza@gmail.com",
    "qualification": {
      "status": "pending"
    },
    "footerText": "Prévenir les risques psychosociaux. Faire grandir la qualité du lien.",
    "contactText": "Un premier échange pour comprendre votre situation et envisager la suite, ensemble."
  },
  "home": {
    "eyebrow": "Prévention des risques psychosociaux · Qualité du lien",
    "title": "Prévenir les risques psychosociaux à leur racine : la qualité du lien au cœur de la performance collective",
    "intro": "Stress, tensions, désengagement, départs : ce qui fragilise une entreprise commence souvent dans la relation.\n\nCALAS Conseil vous aide à comprendre l’origine des difficultés, puis à agir concrètement sur l’organisation, le management et les dynamiques d’équipe.",
    "primaryCta": {
      "label": "Faire le point sur vos risques",
      "href": "/diagnostic-rps/"
    },
    "secondaryCta": {
      "label": "Échanger sur votre situation",
      "href": "/contact/"
    },
    "statisticsTitle": "Les chiffres parlent d’eux-mêmes.",
    "statisticsTransition": "Quand le lien se fragilise, cela finit par se ressentir dans toute l’organisation.",
    "statistics": [
      {
        "id": "stat-stress",
        "value": "39 %",
        "label": "des salariés interrogés en France ont ressenti beaucoup de stress une grande partie de la veille.",
        "source": "Gallup · State of the Global Workplace 2026",
        "sourceUrl": "https://www.gallup.com/workplace/705338/state-global-workplace-france-country-level-data.aspx",
        "year": "2026",
        "note": "France · moyenne glissante 2023–2025. Le stress n’est pas nécessairement lié au travail.",
        "verified": true
      },
      {
        "id": "stat-detresse",
        "value": "1 sur 2",
        "label": "salarié présente un signe de détresse psychologique.",
        "source": "Empreinte Humaine / Ipsos bva · juin 2026",
        "sourceUrl": "https://empreintehumaine.com/aef-info-la-moitie-des-salaries-francais-presente-un-signe-de-detresse-psychologique-empreinte-humaine/",
        "year": "2026",
        "note": "Salariés français interrogés. Un signe de détresse n’est pas un diagnostic médical.",
        "verified": true
      },
      {
        "id": "stat-arrets",
        "value": "36 %",
        "label": "des arrêts longs sont liés aux risques psychosociaux dans les données WTW.",
        "source": "WTW · Baromètre absentéisme 2025",
        "sourceUrl": "https://www.wtwco.com/fr-fr/news/2025/09/hausse-del-absenteisme-en-2024-un-signal-dalerte-pour-les-entreprises",
        "year": "2025",
        "note": "Données 2024 · secteur privé. Arrêts longs : plus de 90 jours.",
        "verified": true
      },
      {
        "id": "stat-cout",
        "value": "> 120 Md€",
        "label": "par an : le coût global estimé de l’absentéisme pour les entreprises françaises.",
        "source": "Estimation relayée par WTW · 2025",
        "sourceUrl": "https://www.wtwco.com/fr-fr/news/2025/09/hausse-del-absenteisme-en-2024-un-signal-dalerte-pour-les-entreprises",
        "year": "2025",
        "note": "Coûts directs et indirects de l’ensemble de l’absentéisme, pas des seuls RPS.",
        "verified": true
      }
    ],
    "diagnostic": {
      "title": "Voir clair avant d’agir.",
      "text": "L’évaluation des risques psychosociaux est une obligation. Nous en faisons un vrai outil de pilotage : une lecture précise de ce qui fragilise le travail (l’organisation, les relations, les personnes) et des priorités d’action concrètes.",
      "cta": {
        "label": "Découvrir le diagnostic",
        "href": "/diagnostic-rps/"
      }
    },
    "reasonsTitle": "Croiser les regards.\nRelier le diagnostic à l’action.",
    "reasons": [
      {
        "title": "Un binôme complémentaire",
        "text": "Au croisement de l’entreprise et de l’humain : une ancienne DRH habilitée IPRP, qui connaît les réalités et les contraintes de l’entreprise, et une psychologue clinicienne, qui apporte un éclairage sur les dynamiques humaines et relationnelles."
      },
      {
        "title": "Agir à la source",
        "text": "Derrière les tensions, des émotions, des croyances et des mécanismes relationnels influencent les comportements. C’est à ce niveau que nous intervenons, pour comprendre ce qui se joue et faire évoluer durablement les situations."
      },
      {
        "title": "Une démarche cohérente",
        "text": "Du diagnostic à l’action : nous mobilisons nos propres outils pour accompagner les transformations dans la durée, au-delà des formations ponctuelles, afin d’ancrer les changements dans les pratiques quotidiennes."
      }
    ],
    "domainsTitle": "Trois entrées.\nUne même attention au lien.",
    "domainsIntro": "Chaque accompagnement peut être choisi seul. Ensemble, ils forment une démarche complète.",
    "conviction": {
      "title": "Demain, le lien sera un métier.",
      "text": "On forme les managers à organiser, décider, piloter. Rarement à tenir le lien. C’est pourtant ce qui fait tenir une équipe quand tout bouge. Nous aidons les entreprises à en faire une compétence, pas à pas.",
      "cta": {
        "label": "Explorer notre approche",
        "href": "/notre-approche/"
      }
    },
    "closingTitle": "Commençons par regarder\nce qui se passe chez vous.",
    "closingCta": {
      "label": "Prendre contact",
      "href": "/contact/"
    },
    "seo": {
      "title": "Calas Conseil — Diagnostic RPS et qualité du lien",
      "description": "Diagnostic et prévention des risques psychosociaux, accompagnement des équipes et des managers. Comprendre le travail et agir sur la qualité du lien."
    },
    "editorial": {
      "heroAudience": "Aux côtés des dirigeants de PME & ETI,\ndes RH et des CSE.",
      "heroDisciplines": [
        "Organisation",
        "Management",
        "Relations"
      ],
      "heroArtTop": "De la compréhension",
      "heroArtBottom": "à la transformation",
      "heroArtCaption": "La voie de la\nqualité relationnelle.",
      "exploreLabel": "Explorer notre démarche",
      "statisticsEyebrow": "Prendre la mesure",
      "statisticsDescription": "Derrière les indicateurs, des situations de travail.\nEt des liens qui ont besoin d’attention.",
      "statisticsNote": "Ces données décrivent des réalités distinctes et ne mesurent pas la même chose.",
      "diagnosticEyebrow": "Diagnostic & prévention des RPS",
      "diagnosticArtEyebrow": "Comprendre ce qui se joue",
      "diagnosticArtLegend": [
        "Organisation",
        "Relations",
        "Personnes"
      ],
      "diagnosticArtTitle": "Relier les signaux.\nFaire émerger le sens.",
      "diagnosticNote": "L’évaluation des RPS fait partie des obligations de prévention de l’employeur. Nous vous aidons à structurer cette démarche.",
      "reasonsEyebrow": "Pourquoi Calas Conseil",
      "reasonsLink": {
        "label": "Rencontrer Sara & Agnès",
        "href": "/qui-sommes-nous/"
      },
      "reasonsMotifLabel": "Le lien",
      "domainsEyebrow": "Nos accompagnements",
      "convictionEyebrow": "Notre conviction"
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
        "description": "Contactez Calas Conseil pour un diagnostic RPS, un accompagnement d’équipe ou de managers."
      },
      "contact": {
        "formEyebrow": "Nous écrire",
        "formTitle": "Votre situation,\nen quelques mots.",
        "directHeading": "Vous préférez un contact direct ?",
        "context": "Diagnostic RPS, équipe ou management : choisissez l’objet qui se rapproche le plus de votre situation.",
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
      "title": "Voir clair\navant d’agir.",
      "intro": "Les tensions ont toujours un sens. Notre diagnostic permet de les lire avec justesse : ce qui relève de l’organisation du travail, ce qui relève des relations, ce qui fragilise les personnes. Vous savez où agir, et par où commencer.",
      "cta": {
        "label": "Parlons de votre diagnostic",
        "href": "/contact/?objet=diagnostic"
      },
      "seo": {
        "title": "Diagnostic RPS — Voir clair avant d’agir | Calas Conseil",
        "description": "Un diagnostic des risques psychosociaux pour comprendre les situations de travail, identifier les facteurs de risque et construire des priorités d’action."
      },
      "sections": [
        {
          "key": "signaux",
          "kind": "list",
          "eyebrow": "Reconnaître les signaux",
          "title": "Quand les difficultés\nfinissent par se répéter.",
          "text": "Un diagnostic devient utile quand les signaux s’accumulent, que les explications se contredisent ou que les premières réponses ne suffisent plus.",
          "items": [
            {
              "title": "Des tensions qui reviennent",
              "text": "Les mêmes désaccords réapparaissent, les échanges se crispent, certains sujets deviennent difficiles à aborder. Il est temps de regarder ce qui entretient la situation, au-delà du conflit visible."
            },
            {
              "title": "Des arrêts, départs ou conflits en hausse",
              "text": "Ces évolutions méritent d’être mises en perspective avec les conditions de travail, les changements vécus et les ressources du collectif. Un indicateur seul ne raconte pas toute l’histoire."
            },
            {
              "title": "Une évaluation des RPS à structurer",
              "text": "Vous souhaitez mieux identifier les facteurs de risque et disposer d’éléments utiles pour votre document unique et votre démarche de prévention."
            },
            {
              "title": "Le besoin d’une lecture partagée",
              "text": "La direction, les RH ou le CSE ont besoin d’objectiver ce qui se passe. Croiser les regards aide à dépasser les impressions et à construire une base de discussion commune."
            }
          ],
          "presentation": "default",
          "navigationLabel": "Les signaux"
        },
        {
          "key": "etapes",
          "kind": "steps",
          "eyebrow": "Une démarche en cinq temps",
          "title": "De l’écoute\naux priorités d’action.",
          "text": "Une progression pour comprendre avant de décider. Chaque étape s’inscrit dans le périmètre et les règles définis avec vous.",
          "items": [
            {
              "title": "Cadrer",
              "text": "Clarifier la demande, le périmètre et les acteurs associés.\n\nNous précisons ce qui motive le diagnostic, les situations à examiner et les questions auxquelles il doit répondre. Les modalités d’écoute, de confidentialité et de restitution sont convenues avant de commencer."
            },
            {
              "title": "Écouter",
              "text": "Mettre en regard les données RH et la parole sur le travail.\n\nLes informations disponibles donnent des repères ; l’expérience des personnes aide à comprendre ce qu’elles signifient. L’attention porte sur les situations de travail, les difficultés rencontrées et ce qui permet déjà de les traverser."
            },
            {
              "title": "Analyser",
              "text": "Identifier les facteurs de risque et les ressources.\n\nNous croisons les éléments recueillis pour distinguer ce qui relève de l’organisation, du management et des relations. Exigences émotionnelles, autonomie, reconnaissance et conflits de valeurs font partie des dimensions examinées."
            },
            {
              "title": "Restituer",
              "text": "Partager une lecture claire avec les acteurs convenus.\n\nLa restitution met les constats en perspective et rend les enjeux discutables collectivement. Elle s’appuie sur le cadre de partage défini au départ, avec une attention particulière à la confidentialité des paroles recueillies."
            },
            {
              "title": "Construire la suite",
              "text": "Passer des constats à des priorités concrètes.\n\nLe diagnostic ouvre sur des recommandations priorisées : où agir, par quoi commencer, sur l’organisation comme sur les relations. Le périmètre d’un éventuel accompagnement de la suite se discute à partir de ces éléments."
            }
          ],
          "presentation": "method",
          "instruction": "Explorez les étapes de la démarche.",
          "navigationLabel": "La démarche"
        },
        {
          "key": "regards",
          "kind": "split",
          "eyebrow": "L’organisation et les relations",
          "title": "Deux regards.\nUne lecture d’ensemble.",
          "text": "L’expérience d’une ancienne DRH et le regard d’une psychologue clinicienne se complètent. Nous relions les contraintes de l’entreprise à ce qui se joue entre les personnes, sans isoler l’une de ces dimensions.",
          "items": [
            {
              "title": "Le travail dans son contexte",
              "text": "Les exigences du travail, les marges de manœuvre et les règles de fonctionnement influencent les relations. Les examiner évite de faire porter aux seules personnes la responsabilité des tensions."
            },
            {
              "title": "Le lien comme point d’attention",
              "text": "Les émotions, les croyances et les mécanismes relationnels éclairent les réactions. Nous les considérons avec l’autonomie, les relations et la reconnaissance, les exigences émotionnelles et les conflits de valeurs."
            },
            {
              "title": "Une continuité vers l’action",
              "text": "Comprendre sert à choisir la suite. Nous articulons la lecture des difficultés avec des pistes d’évolution des pratiques et du cadre de travail."
            }
          ],
          "presentation": "default",
          "navigationLabel": "Nos regards"
        },
        {
          "key": "livrables",
          "kind": "list",
          "eyebrow": "Ce que vous obtenez",
          "title": "Des repères pour décider.\nDes priorités pour agir.",
          "text": "Des livrables qui rendent la situation plus lisible et soutiennent la discussion. Leur périmètre exact est fixé dans chaque proposition.",
          "items": [
            {
              "title": "Une synthèse claire",
              "text": "Une lecture structurée des constats et des enjeux, pour disposer d’une compréhension d’ensemble et la partager avec les acteurs convenus."
            },
            {
              "title": "Une cartographie des facteurs de risque",
              "text": "Une mise en évidence des fragilités et des ressources, reliées aux situations de travail et à leurs différentes dimensions."
            },
            {
              "title": "Des recommandations priorisées",
              "text": "Des pistes d’action argumentées pour distinguer les enjeux et décider des premières suites à donner au diagnostic."
            },
            {
              "title": "Des éléments pour votre document unique",
              "text": "Des éléments utiles à l’évaluation des RPS et à la démarche de prévention, dans le cadre du périmètre de mission retenu."
            }
          ],
          "presentation": "deliverables",
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
      "offerExcerpt": "Les tensions ont toujours un sens.",
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
      "eyebrow": "Accompagner les équipes",
      "title": "Apprendre à dire\nsans casser le lien.",
      "intro": "Derrière chaque tension, une émotion peut signaler ce qui compte et une croyance influencer notre réaction. Nos conférences et ateliers donnent aux équipes un langage commun pour reconnaître ce qui se joue, sortir du pilote automatique et parler vrai en préservant le lien.",
      "cta": {
        "label": "Trouver le format pour votre équipe",
        "href": "/contact/?objet=equipes"
      },
      "sections": [
        {
          "key": "situations",
          "kind": "list",
          "eyebrow": "Quand la parole devient difficile",
          "title": "Mieux comprendre\nce qui se joue entre nous.",
          "text": "Le désaccord fait partie de la vie d’une équipe. La manière de l’exprimer peut ouvrir une discussion utile, ou fragiliser la relation.",
          "items": [
            {
              "title": "Reconnaître le signal",
              "text": "Une tension, un agacement, une inquiétude peuvent indiquer qu’une limite, un besoin ou un enjeu important n’a pas trouvé sa place dans l’échange."
            },
            {
              "title": "Sortir du pilote automatique",
              "text": "Sous pression, nos réactions et nos croyances prennent parfois le dessus. Les reconnaître donne la possibilité de choisir une autre manière d’entrer en relation."
            },
            {
              "title": "Construire un langage commun",
              "text": "Mettre des mots sur ce que l’on vit aide à se comprendre. L’enjeu est de pouvoir parler du travail et de ses difficultés avec davantage de précision."
            },
            {
              "title": "Dire sans rompre",
              "text": "Exprimer un désaccord, poser une limite ou formuler une demande peut s’apprendre, avec une attention à ce que l’on veut dire et à la relation que l’on souhaite préserver."
            }
          ],
          "presentation": "default"
        },
        {
          "key": "conference",
          "kind": "split",
          "eyebrow": "Pour ouvrir la conversation",
          "title": "Stress et émotions au travail,\ndu signal à l’action.",
          "text": "Une conférence pour mieux comprendre les signaux du stress, le rôle des émotions et leur place dans les relations de travail. Un premier temps pour partager des repères et ouvrir la réflexion.",
          "items": [
            {
              "title": "Donner des repères accessibles",
              "text": "Faire le lien entre ce qui est ressenti, ce qui compte dans une situation et la manière dont chacun réagit. Les émotions deviennent un sujet que l’on peut regarder et nommer."
            },
            {
              "title": "Relier la réflexion au travail",
              "text": "La compréhension des réactions individuelles se relie aux relations, aux contraintes et au cadre collectif. Elle ouvre une conversation sur la façon de travailler ensemble."
            }
          ],
          "presentation": "default",
          "navigationLabel": "La conférence"
        },
        {
          "key": "ateliers",
          "kind": "list",
          "eyebrow": "La Boussole émotionnelle",
          "title": "Un espace pour\npasser à la pratique.",
          "text": "Les ateliers prolongent la réflexion dans un format de petit groupe. Ils permettent de s’arrêter sur une émotion et sur ce qu’elle change dans la relation.",
          "items": [
            {
              "title": "La colère : de la tension à l’affirmation",
              "text": "Premier atelier de La Boussole émotionnelle : 3 heures, en petit groupe. Reconnaître le signal, clarifier ce qui compte et travailler une expression qui préserve le lien."
            },
            {
              "title": "La peur et les croyances",
              "text": "Prochainement : d’autres ateliers pour prolonger cette exploration. Ils aborderont le rôle de la peur et l’influence des croyances dans nos réactions et nos relations de travail."
            }
          ],
          "presentation": "default",
          "navigationLabel": "Les ateliers"
        },
        {
          "key": "pratique",
          "kind": "steps",
          "eyebrow": "Une même direction",
          "title": "Reconnaître.\nExprimer. Ajuster.",
          "items": [
            {
              "title": "Reconnaître",
              "text": "Observer ce qui se passe dans une situation : l’émotion ressentie, les réactions qu’elle déclenche, les croyances qui peuvent orienter notre lecture."
            },
            {
              "title": "Exprimer",
              "text": "Mettre des mots sur ce qui compte, formuler ce que l’on souhaite dire et distinguer l’affirmation de soi de l’attaque de l’autre."
            },
            {
              "title": "Ajuster",
              "text": "Chercher une manière d’agir qui tienne compte de soi, de l’autre et du cadre de travail. Le lien se travaille dans ces ajustements."
            }
          ],
          "presentation": "default"
        },
        {
          "key": "limites",
          "kind": "notice",
          "title": "Le travail reste\nnotre point d’ancrage.",
          "text": "Ce n’est pas de la thérapie, et cela ne remplace pas les actions sur l’organisation du travail. Les émotions et les croyances sont abordées en lien avec les situations professionnelles et les relations dans l’équipe.",
          "presentation": "default"
        },
        {
          "key": "questions",
          "kind": "list",
          "eyebrow": "Choisir un point d’entrée",
          "title": "Quel format pour\nvotre équipe ?",
          "items": [
            {
              "title": "Conférence ou atelier ?",
              "text": "La conférence ouvre une réflexion et permet de partager des repères. L’atelier consacre davantage de place à l’exploration d’une émotion dans un petit groupe. Le choix dépend de votre situation et de ce que vous souhaitez travailler."
            },
            {
              "title": "Et si les tensions renvoient à l’organisation ?",
              "text": "Les formats autour des émotions ne se substituent pas à une analyse du travail. Si les difficultés appellent d’abord une lecture des facteurs de risque, un diagnostic peut constituer un point d’entrée plus adapté."
            }
          ],
          "presentation": "faq",
          "navigationLabel": "Vos questions"
        }
      ],
      "seo": {
        "title": "Équipes — Parler vrai et préserver le lien | Calas Conseil",
        "description": "Conférence et ateliers pour reconnaître les émotions au travail, construire un langage commun et exprimer les désaccords en préservant le lien."
      },
      "offerExcerpt": "Derrière chaque tension, une émotion peut signaler ce qui compte et une croyance influencer notre réaction.",
      "editorial": {
        "artTop": "LIRE LE TRAVAIL AUTREMENT",
        "artBottom": "ORGANISATION · MANAGEMENT · RELATIONS",
        "invitationEyebrow": "Et maintenant ?",
        "invitationTitle": "Commençons par\nvotre situation."
      }
    },
    {
      "id": "page-managers",
      "slug": "managers",
      "eyebrow": "Managers & dirigeants",
      "title": "Faire du manager\nun professionnel du lien.",
      "intro": "Le parcours « Le manager, professionnel du lien » s’inscrit dans la durée. Apports, situations vécues et expérimentation permettent de construire une posture : un manager qui clarifie, soutient et fait grandir.",
      "cta": {
        "label": "Échanger sur vos enjeux managériaux",
        "href": "/contact/?objet=managers"
      },
      "sections": [
        {
          "key": "posture",
          "kind": "list",
          "eyebrow": "Une posture qui se travaille",
          "title": "Clarifier. Soutenir.\nFaire grandir.",
          "text": "Tenir le lien ne consiste pas à éviter les désaccords ou à porter seul toutes les difficultés. C’est apprendre à devenir un point d’appui dans un cadre de travail réel.",
          "items": [
            {
              "title": "Clarifier ce qui est attendu",
              "text": "Rendre les règles et les priorités compréhensibles. Aider chacun à situer sa contribution et à identifier les marges de manœuvre dont il dispose."
            },
            {
              "title": "Soutenir une parole possible",
              "text": "Écouter ce qui se passe, accueillir un désaccord et intervenir dans les tensions sans perdre de vue le travail à accomplir ensemble."
            },
            {
              "title": "Accompagner l’autonomie",
              "text": "Créer les conditions pour apprendre, prendre des initiatives et grandir dans son rôle, en articulant soutien et responsabilité."
            }
          ],
          "presentation": "default"
        },
        {
          "key": "cycles",
          "kind": "steps",
          "eyebrow": "Le manager, professionnel du lien",
          "title": "Soi. L’équipe.\nLe système.",
          "text": "Trois cycles pour relier la compréhension de soi, les pratiques avec l’équipe et l’organisation dans laquelle elles s’inscrivent.",
          "items": [
            {
              "title": "Soi",
              "text": "Reconnaître ses réactions, ses émotions et ses croyances. Comprendre ce qui se joue dans sa posture, notamment sous pression, pour disposer de davantage de choix dans la relation.\n\nLe point de départ : ce que j’apporte dans l’échange et la manière dont je réagis."
            },
            {
              "title": "L’équipe",
              "text": "Clarifier le cadre, soutenir la parole et réguler les tensions. Travailler les relations qui permettent à un collectif de coopérer sans effacer les différences.\n\nLe point d’attention : ce qui aide chacun à trouver sa place et à contribuer."
            },
            {
              "title": "Le système",
              "text": "Relier les pratiques managériales aux contraintes de l’organisation et aux marges de manœuvre réelles. Distinguer ce qui peut se jouer dans la relation de ce qui demande une évolution du cadre.\n\nLa perspective : une posture cohérente avec le travail et son organisation."
            }
          ],
          "presentation": "default",
          "navigationLabel": "Les trois cycles"
        },
        {
          "key": "experience",
          "kind": "split",
          "eyebrow": "Apprendre dans la durée",
          "title": "Partir du vécu.\nRevenir à la pratique.",
          "text": "Une posture ne se transforme pas uniquement par des apports. Le parcours fait dialoguer les repères, les situations vécues et l’expérimentation, pour relier la réflexion aux pratiques quotidiennes.",
          "items": [
            {
              "title": "Des apports pour comprendre",
              "text": "Des repères sur les émotions, les croyances et les dynamiques relationnelles, afin de mettre en perspective ce que les managers rencontrent."
            },
            {
              "title": "Des situations pour travailler",
              "text": "Les situations vécues donnent matière à regarder les réactions, les choix possibles et leurs effets dans la relation."
            },
            {
              "title": "L’expérimentation pour ajuster",
              "text": "Essayer, observer ce qui se passe et reprendre la réflexion : cette continuité donne une place au changement dans le travail réel."
            }
          ],
          "presentation": "default",
          "navigationLabel": "Dans la durée"
        },
        {
          "key": "cadre",
          "kind": "notice",
          "title": "Le manager n’agit\npas hors du système.",
          "text": "Développer une posture relationnelle ne dispense pas de regarder la charge, les règles, les décisions et les marges de manœuvre. La responsabilité du lien s’inscrit dans l’organisation ; elle ne repose pas sur le seul effort individuel du manager.",
          "presentation": "default",
          "navigationLabel": "Le cadre de travail"
        },
        {
          "key": "questions",
          "kind": "list",
          "eyebrow": "Construire votre parcours",
          "title": "Un accompagnement\nà situer dans votre contexte.",
          "items": [
            {
              "title": "À qui s’adresse cette démarche ?",
              "text": "Aux managers et dirigeants qui souhaitent faire évoluer leur manière de clarifier, de soutenir et de faire grandir leurs équipes, en tenant compte des exigences de leur organisation."
            },
            {
              "title": "Quelle durée, quel rythme, quel format ?",
              "text": "Les modalités sont à définir à partir de votre contexte, des personnes concernées et des enjeux identifiés. Elles sont précisées dans la proposition d’accompagnement."
            },
            {
              "title": "Faut-il commencer par un diagnostic ?",
              "text": "Chaque accompagnement peut être choisi seul. Un premier échange permet de situer la demande : parcours managérial, travail avec une équipe ou besoin préalable de mieux comprendre les facteurs de risque."
            }
          ],
          "presentation": "faq",
          "navigationLabel": "Vos questions"
        }
      ],
      "seo": {
        "title": "Managers — Devenir un professionnel du lien | Calas Conseil",
        "description": "Un parcours dans la durée pour développer une posture managériale qui clarifie, soutient et fait grandir, du travail sur soi au cadre collectif."
      },
      "offerExcerpt": "Le parcours « Le manager, professionnel du lien » s’inscrit dans la durée.",
      "editorial": {
        "artTop": "LIRE LE TRAVAIL AUTREMENT",
        "artBottom": "ORGANISATION · MANAGEMENT · RELATIONS",
        "invitationEyebrow": "Et maintenant ?",
        "invitationTitle": "Commençons par\nvotre situation."
      }
    },
    {
      "id": "page-approche",
      "slug": "notre-approche",
      "eyebrow": "Notre conviction",
      "title": "Le lien ne se décrète pas.\nIl se construit.",
      "intro": "Exister, compter dans un collectif, pouvoir grandir : trois repères qui orientent notre regard sur le travail. Nous pensons que la qualité du lien se développe lorsque l’organisation en crée les conditions.",
      "cta": {
        "label": "Parlons de votre situation",
        "href": "/contact/"
      },
      "sections": [
        {
          "key": "besoins",
          "kind": "steps",
          "eyebrow": "Trois repères pour regarder le travail",
          "title": "Exister. Compter.\nPouvoir grandir.",
          "text": "Ces repères orientent notre approche de la relation au travail. Nous les considérons comme une grille de lecture, à relier à chaque situation.",
          "items": [
            {
              "title": "Exister",
              "text": "Être reconnu comme une personne, pouvoir exprimer ce qui compte et trouver un espace où sa parole est entendue."
            },
            {
              "title": "Compter dans un collectif",
              "text": "Comprendre sa contribution, se sentir partie prenante et pouvoir trouver sa place dans les relations de travail."
            },
            {
              "title": "Pouvoir grandir",
              "text": "Apprendre, oser une initiative et développer son autonomie, avec des repères et un soutien adaptés."
            }
          ],
          "presentation": "default",
          "navigationLabel": "Nos repères"
        },
        {
          "key": "surface",
          "kind": "text",
          "title": "Comprendre ce qui se joue\nsous la surface.",
          "text": "Nos émotions nous aident à identifier ce qui est important pour nous, tandis que nos croyances influencent nos réactions, souvent sans que nous en ayons conscience. Sous pression, ces mécanismes peuvent modifier notre façon de travailler et d’entrer en relation.\n\nQuand la possibilité d’exister, de compter ou de grandir semble fragilisée, chacun peut chercher à se protéger : en se retirant, en s’opposant ou en prenant de la distance. Ces réactions méritent d’être comprises dans leur contexte, sans les réduire à un trait de personnalité.\n\nApprendre à reconnaître ce qui se passe en soi aide à mieux comprendre l’échange. Mais cette compréhension, à elle seule, ne transforme pas le cadre de travail.",
          "presentation": "default",
          "navigationLabel": "Sous la surface"
        },
        {
          "key": "cadre",
          "kind": "split",
          "eyebrow": "Le cadre compte autant que les personnes",
          "title": "Des règles claires.\nUne parole possible.",
          "text": "La qualité du lien dépend aussi de l’organisation dans laquelle il s’inscrit. Un manager qui constitue un point d’appui, des règles compréhensibles et un espace de parole attentif aux personnes créent des conditions favorables à la confiance.",
          "items": [
            {
              "title": "Un cadre qui rend le travail lisible",
              "text": "Savoir ce qui est attendu, ce qui se décide et où se trouvent les marges de manœuvre. La clarté du cadre soutient la relation et permet de discuter le travail."
            },
            {
              "title": "La possibilité de dire",
              "text": "Une parole qui peut circuler permet d’aborder les difficultés et les désaccords avant qu’ils ne deviennent impossibles à nommer."
            },
            {
              "title": "La confiance pour agir",
              "text": "Dans un cadre qui soutient le travail, chacun peut davantage oser, prendre des initiatives et coopérer sans renoncer à qui il est."
            }
          ],
          "presentation": "default",
          "navigationLabel": "Le cadre de travail"
        },
        {
          "key": "coherence",
          "kind": "split",
          "eyebrow": "Du diagnostic à l’action",
          "title": "Tenir ensemble\nles trois dimensions.",
          "text": "Notre démarche relie organisation, management et relations. C’est cette articulation qui donne du sens à nos différents accompagnements.",
          "items": [
            {
              "title": "Comprendre les situations",
              "text": "Le diagnostic met en perspective les facteurs de risque, les ressources et les situations de travail pour identifier des priorités d’action."
            },
            {
              "title": "Développer un langage commun",
              "text": "Avec les équipes, nous travaillons la compréhension des émotions et des croyances, ainsi que leur expression dans la relation."
            },
            {
              "title": "Faire évoluer la posture",
              "text": "Avec les managers, nous relions compréhension de soi, pratiques avec l’équipe et contraintes du système."
            }
          ],
          "presentation": "default"
        },
        {
          "key": "conviction",
          "kind": "notice",
          "title": "Le lien est\nune compétence.",
          "text": "Il s’apprend, se développe et peut devenir un levier de performance collective. C’est la conviction qui guide Calas Conseil : aider les entreprises à en faire une compétence, pas à pas.",
          "presentation": "default"
        }
      ],
      "seo": {
        "title": "Notre approche — La qualité du lien se construit | Calas Conseil",
        "description": "Organisation, management et relations : la conviction de Calas Conseil pour faire de la qualité du lien une compétence au service du collectif."
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
      "title": "L’entreprise et l’humain.\nDeux regards qui se rencontrent.",
      "intro": "Croiser l’expérience de la direction RH et la psychologie clinique pour comprendre les situations de travail dans leur ensemble.",
      "cta": {
        "label": "Faire connaissance",
        "href": "/contact/"
      },
      "sections": [
        {
          "key": "binome",
          "kind": "split",
          "eyebrow": "Ce qui nous réunit",
          "title": "Croiser les regards\npour mieux comprendre.",
          "text": "Calas Conseil se situe au croisement de l’entreprise et de l’humain. L’expérience de la direction RH et la psychologie clinique apportent des éclairages complémentaires sur les situations de travail.",
          "items": [
            {
              "title": "Comprendre les réalités de l’entreprise",
              "text": "Prendre en compte l’organisation, les responsabilités, les contraintes et les exigences de résultat qui structurent le quotidien du travail."
            },
            {
              "title": "Éclairer les dynamiques humaines",
              "text": "Regarder ce qui se joue dans les relations, les réactions et les mécanismes qui peuvent entretenir les tensions."
            },
            {
              "title": "Relier le constat à la suite",
              "text": "Faire de cette lecture croisée un appui pour identifier des priorités et envisager des évolutions des pratiques."
            }
          ],
          "presentation": "default"
        },
        {
          "key": "attention",
          "kind": "notice",
          "title": "Une même attention\nau travail et au lien.",
          "text": "Notre point de départ est votre situation. Nous prenons le temps d’en comprendre les enjeux pour situer la demande et définir un cadre d’intervention, avec les acteurs concernés.",
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
          "text": "Le formulaire recueille votre nom, votre courriel, l’objet de votre demande et votre message. L’entreprise est facultative. Ces informations servent à traiter votre demande. Merci de ne pas transmettre d’informations médicales ni de données concernant un tiers.",
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
      "role": "Consultante en relations humaines et stratégie RH",
      "bio": "Mon parcours croise deux mondes : dix ans d’accompagnement des personnes en institution, puis des postes de direction en entreprise, jusqu’à DRH. Je relie compréhension humaine et exigences de résultat.\nAncienne DRH, praticienne en analyse transactionnelle."
    },
    {
      "id": "person-agnes",
      "name": "Agnès Loupias",
      "role": "Psychologue clinicienne"
    }
  ],
  "articles": []
};
