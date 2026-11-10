import type { Article, Person } from './types';

// Sources supplied by Sara through Paul on 1 November 2026. Titles, authors and
// publication dates checked on LinkedIn. These are reading links, not imported texts.
const sara: Person = { id: 'person-sara', name: 'Sara Serrano Cabeza', role: 'Consultante en relations humaines et stratégie RH' };
const category = { title: 'Management et qualité du lien', slug: 'management-qualite-du-lien' };

export const linkedinArticles: Article[] = [
  {
    id: 'linkedin-manager-xxie-siecle',
    slug: 'manager-xxie-siecle',
    title: 'Manager au XXIe siècle, c’est comprendre ce qui fait sens pour un être humain',
    date: '2026-06-11T00:00:00.000Z',
    excerpt: 'Reconnaissance, appartenance et développement personnel : une réflexion sur les besoins humains auxquels le management doit répondre.',
    externalUrl: 'https://www.linkedin.com/pulse/manager-au-xxie-si%C3%A8cle-cest-comprendre-ce-qui-fait-un-serrano-cabeza-5q3de/',
    body: { type: 'doc', content: [] }, author: sara, category,
  },
  {
    id: 'linkedin-version-realite',
    slug: 'chacun-sa-version-de-la-realite',
    title: 'Personne ne voit la réalité. Chacun voit sa version de la réalité.',
    date: '2026-06-18T00:00:00.000Z',
    excerpt: 'Nos expériences et nos convictions influencent notre lecture des situations. Comment prendre du recul sur ce qui guide une décision managériale ?',
    externalUrl: 'https://www.linkedin.com/pulse/personne-ne-voit-la-r%C3%A9alit%C3%A9-chacun-sa-version-de-sara-serrano-cabeza-2tjbe/',
    body: { type: 'doc', content: [] }, author: sara, category,
  },
  {
    id: 'linkedin-cinq-drivers',
    slug: 'cinq-drivers-management-sous-pression',
    title: 'Les 5 drivers qui façonnent votre management sous pression',
    date: '2026-06-25T00:00:00.000Z',
    excerpt: 'Quand la tension monte, certains automatismes prennent le dessus. Repérer ces comportements ouvre un espace pour choisir une réponse plus ajustée.',
    externalUrl: 'https://www.linkedin.com/pulse/les-5-drivers-qui-fa%C3%A7onnent-votre-management-sous-sara-serrano-cabeza-wgm4e/',
    body: { type: 'doc', content: [] }, author: sara, category,
  },
  {
    id: 'linkedin-motiver-engager',
    slug: 'motiver-engager-sens',
    title: 'Il y a une différence entre motiver et engager, et cette différence s’appelle le sens.',
    date: '2026-09-17T00:00:00.000Z',
    excerpt: 'Distinguer les incitations extérieures de l’implication personnelle au travail : quelle place le sens occupe-t-il dans l’engagement ?',
    externalUrl: 'https://www.linkedin.com/pulse/il-y-une-diff%C3%A9rence-entre-motiver-et-engager-cette-le-serrano-cabeza-v08ge/',
    body: { type: 'doc', content: [] }, author: sara, category,
  },
  {
    id: 'linkedin-lien-libere',
    slug: 'le-lien-qui-libere-le-lien-qui-enferme',
    title: 'Le lien qui libère, le lien qui enferme.',
    date: '2026-09-24T00:00:00.000Z',
    excerpt: 'Une équipe peut sembler soudée tout en dépendant d’une seule personne. Explorer la différence entre dépendance relationnelle, autonomie et coopération.',
    externalUrl: 'https://www.linkedin.com/pulse/le-lien-qui-lib%C3%A8re-enferme-sara-serrano-cabeza-71cue/',
    body: { type: 'doc', content: [] }, author: sara, category,
  },
];
