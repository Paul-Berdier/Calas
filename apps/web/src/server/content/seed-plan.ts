import { createHash } from 'node:crypto';
import type { SiteContent } from '../../lib/cms/types';
import { convertPortableText } from './legacy-rich-text';
import { parseContent, type ContentKind } from './models';

export interface SeedEntry { id: string; kind: ContentKind; content: Record<string, unknown> }
export interface SeedPlan { entries: SeedEntry[]; warnings: string[] }
export function validateSeedPlan(entries: SeedEntry[]): void {
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('Chaque ressource initiale doit avoir un identifiant unique.');
  const kinds = new Map(entries.map(entry => [entry.id, entry.kind]));
  for (const entry of entries) {
    parseContent(entry.kind, entry.content);
    if (entry.kind === 'home') for (const id of entry.content.statisticIds as string[] || []) if (kinds.get(id) !== 'statistic') throw new Error('Référence absente : chiffre de l’accueil.');
    if (entry.kind === 'article') {
      if (entry.content.authorId && kinds.get(String(entry.content.authorId)) !== 'person') throw new Error('Référence absente : auteure d’article.');
      if (entry.content.categoryId && kinds.get(String(entry.content.categoryId)) !== 'category') throw new Error('Référence absente : catégorie d’article.');
    }
  }
}
/** RFC 9562 UUID v8: deterministic namespace-specific hash, never an email/name based credential. */
export function stableContentId(kind: string, key: string): string {
  const bytes = createHash('sha256').update(`calas-conseil:content:v1:${kind}:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x80;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function prepareSeedPlan(source: SiteContent): SeedPlan {
  const content = structuredClone(source);
  const warnings: string[] = [];
  const entries: SeedEntry[] = [];
  const personIds = new Map(content.people.map(person => [person.id, stableContentId('person', person.id)]));
  const statisticIds = new Map(content.home.statistics.map(statistic => [statistic.id, stableContentId('statistic', statistic.id)]));
  const add = (kind: ContentKind, id: string, value: unknown) => entries.push({ id, kind, content: parseContent(kind, value) });
  const convertBody = (value: unknown, context: string) => {
    if (!Array.isArray(value)) return value;
    const result = convertPortableText(value);
    warnings.push(...result.warnings.map(warning => `${context} : ${warning}`));
    return result.document;
  };
  content.people.forEach((person, index) => add('person', personIds.get(person.id)!, { ...person, id: personIds.get(person.id), order: index }));
  content.home.statistics.forEach((statistic, index) => add('statistic', statisticIds.get(statistic.id)!, { ...statistic, id: statisticIds.get(statistic.id), order: index }));
  const qualification = content.settings.qualification;
  if (qualification.personId) {
    const id = personIds.get(qualification.personId);
    if (!id) throw new Error('La qualification référence une personne absente du contenu initial.');
    qualification.personId = id;
  }
  add('settings', stableContentId('settings', 'site'), content.settings);
  add('home', stableContentId('home', 'home'), { ...content.home, statistics: [], statisticIds: content.home.statistics.map(statistic => statisticIds.get(statistic.id)) });
  for (const page of content.pages) {
    const id = stableContentId('page', page.slug);
    const sections = page.sections.map(section => ({ ...section, ...(section.body ? { body: convertBody(section.body, `Page ${page.slug}, section ${section.key}`) } : {}) }));
    add('page', id, { ...page, id, sections });
  }
  const categoryIds = new Map<string, string>();
  for (const article of content.articles) {
    const category = article.category;
    let categoryId: string | undefined;
    if (category) {
      const slug = category.slug || category.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      categoryId = categoryIds.get(slug) || stableContentId('category', slug);
      if (!categoryIds.has(slug)) { add('category', categoryId, { id: categoryId, title: category.title, slug }); categoryIds.set(slug, categoryId); }
    }
    const authorId = article.author ? personIds.get(article.author.id) : undefined;
    if (article.author && !authorId) throw new Error(`Auteure inconnue pour l’article ${article.slug}.`);
    add('article', stableContentId('article', article.slug), {
      title: article.title, slug: article.slug, excerpt: article.excerpt, body: convertBody(article.body, `Article ${article.slug}`), authorId, categoryId, date: article.date,
      image: article.image, sourcePdf: article.sourcePdf, seo: article.seo, allowPdfDownload: false,
    });
  }
  validateSeedPlan(entries);
  return { entries, warnings };
}
