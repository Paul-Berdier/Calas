import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, config } from './content-common.mjs';
import { demoContent } from '../apps/web/src/lib/cms/demo.ts';

function keyed(value) {
  if (Array.isArray(value)) return value.map((item, index) => typeof item === 'object' && item !== null ? { _key: item._key || `item-${index}`, ...keyed(item) } : item);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([key, item]) => [key, keyed(item)]));
  return value;
}
const canonicalId = (kind, value) => `calas-${kind}-${value.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`;
const typed = (value, type) => value == null ? undefined : { ...value, _type: type };
const image = value => value == null ? undefined : {
  ...value, _type: 'contentImage', asset: typed(value.asset, 'reference'),
  crop: typed(value.crop, 'sanity.imageCrop'), hotspot: typed(value.hotspot, 'sanity.imageHotspot'),
};
const reference = id => ({ _type: 'reference', _ref: id, _weak: true });

// Stable IDs make repeated initialisation safe. Named object types are essential for
// Studio array editing; API mutations do not run Studio schema validation.
export function prepareSeedDocuments(content = demoContent) {
  const stats = content.home.statistics.map(s => ({ ...s, _id: canonicalId('statistic', s._id), _type: 'statistic' }));
  const personIds = new Map(content.people.map(p => [p._id, canonicalId('person', p._id)]));
  const people = content.people.map((p, order) => ({ ...p, _id: personIds.get(p._id), _type: 'person', portrait: image(p.portrait), order }));
  const { contactText: _legacyContactText, qualification: originalQualification, ...settings } = content.settings;
  const { personId, ...qualification } = originalQualification;
  if (personId && !personIds.has(personId)) throw new Error('La qualification désigne une personne absente du contenu de départ.');
  const categories = new Map();
  const articles = content.articles.map(article => {
    const authorId = personIds.get(article.author._id);
    if (!authorId) throw new Error(`Auteure absente du catalogue pour l’article « ${article.title} ».`);
    const category = article.category;
    const categoryId = category ? canonicalId('category', category.slug || category.title) : undefined;
    if (category) categories.set(categoryId, { _id: categoryId, _type: 'category', title: category.title, slug: { _type: 'slug', current: category.slug || categoryId.replace('calas-category-', '') } });
    return { ...article, _id: canonicalId('article', article.slug), _type: 'article', slug: { _type: 'slug', current: article.slug }, author: reference(authorId), category: categoryId ? reference(categoryId) : undefined, image: image(article.image), seo: typed(article.seo, 'seo') };
  });
  const documents = [
    { ...settings, _id: 'siteSettings', _type: 'siteSettings', qualification: { ...qualification, person: personId ? reference(personIds.get(personId)) : undefined } },
    ...stats, ...people, ...categories.values(), ...articles,
    ...content.pages.map(page => ({
      ...page, _id: canonicalId('page', page.slug), _type: 'page', slug: { _type: 'slug', current: page.slug },
      cta: typed(page.cta, 'cta'), seo: typed(page.seo, 'seo'), image: image(page.image), editorial: typed(page.editorial, 'pageEditorial'), contact: typed(page.contact, 'contactEditorial'),
      journal: page.journal ? { ...page.journal, _type: 'journalEditorial', seriesCta: typed(page.journal.seriesCta, 'cta') } : undefined,
      sections: page.sections.map(section => ({ ...section, _type: 'section', image: image(section.image), items: section.items?.map(item => typed(item, 'textItem')) })),
    })),
    {
      ...content.home, _id: 'homePage', _type: 'homePage', statistics: stats.map(s => reference(s._id)),
      primaryCta: typed(content.home.primaryCta, 'cta'), secondaryCta: typed(content.home.secondaryCta, 'cta'), closingCta: typed(content.home.closingCta, 'cta'), seo: typed(content.home.seo, 'seo'),
      diagnostic: { ...content.home.diagnostic, cta: typed(content.home.diagnostic.cta, 'cta'), image: image(content.home.diagnostic.image) },
      conviction: { ...content.home.conviction, cta: typed(content.home.conviction.cta, 'cta') },
      reasons: content.home.reasons.map(reason => typed(reason, 'textItem')),
      editorial: content.home.editorial ? { ...content.home.editorial, _type: 'homeEditorial', reasonsLink: typed(content.home.editorial.reasonsLink, 'cta') } : undefined,
    },
  ].map(keyed);
  validateSeedDocuments(documents);
  return documents;
}

export function validateSeedDocuments(documents) {
  const ids = new Set(documents.map(document => document._id));
  if (ids.size !== documents.length) throw new Error('Des identifiants du contenu de départ sont en double.');
  const visit = (value, path) => {
    if (Array.isArray(value)) {
      const keys = new Set();
      for (const item of value) {
        if (item && typeof item === 'object') {
          if (!item._type || !item._key || keys.has(item._key)) throw new Error(`Objet de tableau sans type/clé unique : ${path}.`);
          keys.add(item._key);
        }
        visit(item, path);
      }
    } else if (value && typeof value === 'object') {
      if (value._type === 'reference' && !ids.has(value._ref) && !/^image-[a-zA-Z0-9]+-\d+x\d+-[a-z0-9]+$/.test(value._ref || '')) throw new Error(`Référence absente : ${path}.`);
      if (value._type === 'contentImage' && (!value.asset?._ref || typeof value.alt !== 'string' || value.alt.trim().length < 3)) throw new Error(`Image sans fichier ou description : ${path}.`);
      if (value._type === 'section' && (!value.title || (['steps', 'list'].includes(value.kind) && !value.items?.length))) throw new Error(`Section sans titre ou points : ${path}.`);
      if (value._type === 'section' && value.presentation === 'method' && (value.kind !== 'steps' || value.items?.length !== 5)) throw new Error(`La méthode exige cinq étapes : ${path}.`);
      if (value._type === 'section' && ['faq', 'deliverables'].includes(value.presentation) && value.kind !== 'list') throw new Error(`La FAQ et les livrables exigent le format liste : ${path}.`);
      for (const [key, item] of Object.entries(value)) visit(item, `${path}.${key}`);
    }
  };
  for (const document of documents) {
    if (!document._id || document._id.startsWith('drafts.') || !document._type) throw new Error('Identifiant de départ ou type de document invalide.');
    visit(document, document._id);
  }
}

export async function seedContent(args = process.argv.slice(2)) {
  if (args.some(arg => !['--dry-run', '--'].includes(arg))) throw new Error('Option inconnue. Utilisez --dry-run pour une validation locale sans écriture.');
  const documents = prepareSeedDocuments();
  if (args.includes('--dry-run')) {
    const inventory = Object.fromEntries([...new Set(documents.map(d => d._type))].map(type => [type, documents.filter(d => d._type === type).length]));
    console.log(`${documents.length} documents de départ validés, préparés en brouillon. Aucun appel réseau ni écriture.`);
    console.log(JSON.stringify(inventory));
    return;
  }
  const cfg = config({ write: true });
  const client = createClient(cfg);
  const ids = documents.flatMap(d => [d._id, `drafts.${d._id}`]);
  const slugs = documents.filter(d => d._type === 'page').map(d => d.slug.current);
  const collisions = await client.fetch('*[_type == "page" && slug.current in $slugs && !(_id in $ids)]{_id}', { slugs, ids });
  if (collisions.length) throw new Error('Une page existe déjà sous un autre identifiant. Réconciliez le contenu existant avant l’initialisation ; aucune donnée n’a été écrite.');
  const existing = new Set(await client.fetch('*[_id in $ids]._id', { ids }));
  const missing = documents.filter(d => !existing.has(d._id) && !existing.has(`drafts.${d._id}`));
  if (missing.length) {
    let transaction = client.transaction();
    for (const document of missing) transaction = transaction.createIfNotExists({ ...document, _id: `drafts.${document._id}` });
    await transaction.commit();
  }
  console.log(`${missing.length} brouillons créés dans le dataset de test ; ${documents.length - missing.length} documents existants préservés. Rien n’a été publié.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await seedContent();
