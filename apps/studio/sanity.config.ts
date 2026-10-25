import { defineConfig } from 'sanity';
import { structureTool, type StructureResolver } from 'sanity/structure';
import { presentationTool, defineLocations } from 'sanity/presentation';
import { schemaTypes } from './schemaTypes';
import { PdfImportTool } from './components/PdfImportTool';

const configured = Boolean(process.env.SANITY_STUDIO_PROJECT_ID);
const singletonTypes = new Set(['siteSettings', 'homePage']);
const pages = [
  ['diagnostic-rps', 'Diagnostic RPS'], ['equipes', 'Équipes'], ['managers', 'Managers'],
  ['notre-approche', 'Notre approche'], ['qui-sommes-nous', 'Qui sommes-nous'],
  ['reflexions', 'Réflexions — introduction'], ['contact', 'Contact — introduction'],
  ['mentions-legales', 'Mentions légales'], ['confidentialite', 'Confidentialité'],
] as const;

const structure: StructureResolver = S => S.list().title('Calas Conseil').items([
  S.listItem().title('Accueil').child(S.document().schemaType('homePage').documentId('homePage').title('Accueil')),
  S.listItem().title('Pages du site').child(S.list().title('Pages').items(pages.map(([slug, title]) =>
    S.listItem().title(title).child(S.documentTypeList('page').title(title).filter('_type == "page" && slug.current == $slug').params({ slug }).initialValueTemplates([S.initialValueTemplateItem('page-by-slug', { slug })])),
  ))),
  S.divider(),
  S.documentTypeListItem('person').title('Sara et Agnès'),
  S.documentTypeListItem('statistic').title('Chiffres et sources'),
  S.documentTypeListItem('article').title('Articles et brouillons'),
  S.documentTypeListItem('category').title('Catégories d’articles'),
  S.divider(),
  S.listItem().title('Coordonnées et paramètres').child(S.document().schemaType('siteSettings').documentId('siteSettings').title('Coordonnées et paramètres')),
]);

export default defineConfig({
  name: 'calas-conseil',
  title: configured ? 'Calas Conseil — édition' : 'Calas Conseil — connexion à configurer',
  // A syntactically valid local build placeholder. It is not an existing Calas account.
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'calaslocal',
  dataset: process.env.SANITY_STUDIO_DATASET || 'staging',
  releases: { enabled: false },
  tools: [{ name: 'pdf-import', title: 'Importer un PDF', component: PdfImportTool }],
  plugins: [
    structureTool({ title: 'Contenus', structure }),
    presentationTool({
      title: 'Prévisualiser',
      previewUrl: {
        initial: process.env.SANITY_STUDIO_PREVIEW_URL || 'http://localhost:4321',
        previewMode: { enable: '/api/preview/enable/', disable: '/api/preview/disable/' },
      },
      resolve: { locations: {
        homePage: { locations: [{ title: 'Accueil', href: '/' }] },
        siteSettings: { locations: [{ title: 'Accueil', href: '/' }, { title: 'Contact', href: '/contact/' }] },
        page: defineLocations({ select: { title: 'title', slug: 'slug.current' }, resolve: doc => ({ locations: doc?.slug ? [{ title: doc.title || 'Page', href: `/${doc.slug}/` }] : [] }) }),
        article: defineLocations({ select: { title: 'title', slug: 'slug.current' }, resolve: doc => ({ locations: doc?.slug ? [{ title: doc.title || 'Article', href: `/reflexions/${doc.slug}/` }, { title: 'Réflexions', href: '/reflexions/' }] : [] }) }),
        person: { locations: [{ title: 'Qui sommes-nous', href: '/qui-sommes-nous/' }] },
        statistic: { locations: [{ title: 'Accueil', href: '/' }] },
      } },
    }),
  ],
  schema: {
    types: schemaTypes,
    templates: previous => [
      ...previous.filter(template => !singletonTypes.has(template.schemaType)),
      { id: 'page-by-slug', title: 'Page du site', schemaType: 'page', parameters: [{ name: 'slug', title: 'Adresse', type: 'string' }], value: ({ slug }: { slug: string }) => ({ slug: { _type: 'slug', current: slug } }) },
    ],
  },
  document: {
    actions: (previous, context) => singletonTypes.has(context.schemaType)
      ? previous.filter(action => ['publish', 'discardChanges', 'restore'].includes(action.action ?? ''))
      : previous,
    newDocumentOptions: (previous, { creationContext }) => creationContext.type === 'global'
      ? previous.filter(option => !singletonTypes.has(option.templateId)) : previous,
  },
});
