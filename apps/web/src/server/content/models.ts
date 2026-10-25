import { z } from 'zod';

export const CONTENT_KINDS = ['home', 'page', 'article', 'person', 'statistic', 'category', 'settings'] as const;
export type ContentKind = typeof CONTENT_KINDS[number];
export type ContentStatus = 'draft' | 'published' | 'archived';
export interface EditorialActor { id: string; name: string; role: 'administrator' | 'editor' }
export interface ContentDetail {
  id: string; kind: ContentKind; slug: string; title: string; status: ContentStatus;
  version: number; draftRevisionId: string | null; publishedRevisionId: string | null;
  hasUnpublishedChanges: boolean; content: Record<string, unknown>; updatedAt: string;
}
export interface ContentRevision { id: string; version: number; content: Record<string, unknown>; createdAt: string; createdBy: string | null; createdByName: string; action: string }

export class ContentError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) { super(message); this.name = 'ContentError'; }
}

const short = (maximum = 220) => z.string().max(maximum);
const required = (maximum = 220) => short(maximum).min(1, 'Ce champ est nécessaire.');
const uuid = z.string().uuid();
const optionalId = uuid.optional();
const optionalText = (maximum = 220) => short(maximum).optional();
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Utilisez des minuscules, chiffres et tirets.').max(96);

export function safeEditorialUrl(value: string): boolean {
  if (/[\u0000-\u0020\u007f\\]/.test(value) || value.startsWith('//')) return false;
  if (value.startsWith('/') || value.startsWith('#')) return true;
  try { const url = new URL(value); return ['https:', 'mailto:', 'tel:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
const urlSchema = z.string().max(2048).refine(safeEditorialUrl, 'Utilisez un lien relatif, HTTPS, mailto ou tel valide.');
const httpsUrl = z.string().max(2048).url().refine(value => new URL(value).protocol === 'https:', 'Une adresse HTTPS est nécessaire.');
export const seoSchema = z.object({ title: optionalText(220), description: optionalText(500) }).strict();
export const ctaSchema = z.object({ label: required(120), href: urlSchema }).strict();
const fraction = z.number().min(0).max(1);
export const imageSchema = z.object({
  mediaId: uuid, alt: short(500), width: z.number().int().positive().max(30000).optional(), height: z.number().int().positive().max(30000).optional(),
  crop: z.object({ top: fraction, bottom: fraction, left: fraction, right: fraction }).strict().refine(c => c.top + c.bottom < 1 && c.left + c.right < 1, 'Le recadrage doit conserver une zone visible.').optional(),
  hotspot: z.object({ x: fraction, y: fraction, width: fraction, height: fraction }).strict().optional(),
}).strict();
export const fileSchema = z.object({ mediaId: uuid, originalFilename: optionalText(255), size: z.number().int().positive().max(20 * 1024 * 1024).optional(), mimeType: z.literal('application/pdf').optional() }).strict();

export interface RichNode {
  type: string; text?: string; attrs?: Record<string, unknown>; marks?: Array<{ type: string; attrs?: Record<string, unknown> }>; content?: RichNode[];
}
const richNode: z.ZodType<RichNode> = z.lazy(() => z.object({
  type: z.enum(['doc', 'paragraph', 'text', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'hardBreak', 'horizontalRule', 'image', 'codeBlock']),
  text: z.string().max(200_000).optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  marks: z.array(z.object({ type: z.enum(['bold', 'italic', 'link', 'strike', 'code', 'underline']), attrs: z.record(z.string(), z.unknown()).optional() }).strict()).max(8).optional(),
  content: z.array(richNode).max(5000).optional(),
}).strict());

function inspectRich(node: RichNode, depth = 0, parent = ''): string | null {
  if (depth > 24) return 'Le texte contient trop de niveaux imbriqués.';
  if (node.type === 'doc' && depth !== 0) return 'Un document ne peut pas être imbriqué.';
  if (node.type === 'text' && (typeof node.text !== 'string' || node.content?.length)) return 'Un fragment de texte est invalide.';
  if (node.type !== 'text' && node.text !== undefined) return 'Le texte doit être contenu dans un paragraphe.';
  if (['text', 'hardBreak', 'image', 'horizontalRule'].includes(node.type) && node.content?.length) return 'Ce nœud ne peut pas contenir de texte imbriqué.';
  if (node.type === 'listItem' && !['bulletList', 'orderedList'].includes(parent)) return 'Un élément de liste doit appartenir à une liste.';
  if (['bulletList', 'orderedList'].includes(node.type) && node.content?.some(child => child.type !== 'listItem')) return 'La liste contient un élément invalide.';
  const attrs = node.attrs || {};
  const allowed = node.type === 'heading' ? ['level'] : node.type === 'orderedList' ? ['start', 'type'] : node.type === 'codeBlock' ? ['language'] : node.type === 'image' ? ['mediaId', 'src', 'alt', 'title', 'width', 'height'] : [];
  if (Object.keys(attrs).some(key => !allowed.includes(key))) return 'Un attribut de mise en forme non autorisé a été détecté.';
  if (node.type === 'heading' && ![2, 3].includes(Number(attrs.level))) return 'Seuls les titres H2 et H3 sont autorisés.';
  if (node.type === 'codeBlock' && (node.content?.some(child => child.type !== 'text' && child.type !== 'hardBreak') || attrs.language !== undefined && attrs.language !== null && (typeof attrs.language !== 'string' || attrs.language.length > 50))) return 'Le bloc de code est invalide.';
  if (node.type === 'image') {
    if (!uuid.safeParse(attrs.mediaId).success) return 'Sélectionnez une image de la médiathèque.';
    if (typeof attrs.alt !== 'string' || attrs.alt.length > 500) return 'Renseignez le texte alternatif de l’image.';
    if (attrs.src !== undefined && attrs.src !== `/media/${attrs.mediaId}/`) return 'Une image doit provenir de la médiathèque.';
  }
  for (const mark of node.marks || []) {
    if (mark.type === 'link') {
      const values = mark.attrs || {};
      if (typeof values.href !== 'string' || !safeEditorialUrl(values.href)) return 'Un lien du texte est invalide.';
      if (Object.keys(values).some(key => !['href', 'target', 'rel', 'class', 'title'].includes(key))) return 'Un attribut de lien non autorisé a été détecté.';
      if (values.target !== undefined && values.target !== null && !['_blank', '_self'].includes(String(values.target))) return 'La cible du lien est invalide.';
      if (values.class !== undefined && values.class !== null) return 'Les styles de lien arbitraires sont interdits.';
    } else if (mark.attrs && Object.keys(mark.attrs).length) return 'Un attribut de texte non autorisé a été détecté.';
  }
  for (const child of node.content || []) { const error = inspectRich(child, depth + 1, node.type); if (error) return error; }
  return null;
}

export const richDocumentSchema = richNode.superRefine((value, context) => {
  if (value.type !== 'doc') context.addIssue({ code: 'custom', message: 'Le contenu doit être un document Tiptap.' });
  const error = inspectRich(value);
  if (error) context.addIssue({ code: 'custom', message: error });
  if (JSON.stringify(value).length > 1_000_000) context.addIssue({ code: 'custom', message: 'Le texte dépasse la taille autorisée.' });
});

const item = z.object({ key: optionalText(100), title: required(220), text: required(5000), number: optionalText(20) }).strict();
export const sectionSchema = z.object({
  key: required(100), title: optionalText(220), eyebrow: optionalText(140), text: optionalText(6000),
  kind: z.enum(['text', 'steps', 'list', 'split', 'notice']).optional(), presentation: z.enum(['default', 'method', 'faq', 'deliverables']).optional(),
  navigationLabel: optionalText(100), instruction: optionalText(220), image: imageSchema.optional(), items: z.array(item).max(16).optional(), body: richDocumentSchema.optional(),
}).strict().superRefine((section, context) => {
  if (section.presentation === 'method' && (section.kind !== 'steps' || section.items?.length !== 5)) context.addIssue({ code: 'custom', path: ['items'], message: 'La méthode doit conserver ses cinq étapes.' });
});
const pageEditorial = z.object({ artTop: optionalText(180), artBottom: optionalText(180), methodLinkLabel: optionalText(120), invitationEyebrow: optionalText(140), invitationTitle: optionalText(220) }).strict();
const journalEditorial = z.object({ baseline: optionalText(300), topics: optionalText(300), seriesEyebrow: optionalText(140), seriesStatus: optionalText(140), seriesTitle: optionalText(220), seriesText: optionalText(2000), seriesCta: ctaSchema.optional(), exploreEyebrow: optionalText(140), exploreTitle: optionalText(220) }).strict();
const contactEditorial = z.object({ formEyebrow: optionalText(140), formTitle: optionalText(220), directHeading: optionalText(220), context: optionalText(2000), linkedinLabel: optionalText(140) }).strict();
export const PAGE_SLUGS = ['diagnostic-rps', 'equipes', 'managers', 'notre-approche', 'qui-sommes-nous', 'reflexions', 'contact', 'mentions-legales', 'confidentialite'] as const;
export const pageSchema = z.object({
  id: optionalId, slug: z.enum(PAGE_SLUGS), title: required(250), eyebrow: optionalText(140), intro: required(4000),
  sections: z.array(sectionSchema).max(16), cta: ctaSchema.optional(), image: imageSchema.optional(), seo: seoSchema.optional(),
  format: z.object({ duration: optionalText(150), rhythm: optionalText(220), delivery: optionalText(300) }).strict().optional(), offerExcerpt: optionalText(500),
  editorial: pageEditorial.optional(), journal: journalEditorial.optional(), contact: contactEditorial.optional(),
}).strict().superRefine((page, context) => {
  if (new Set(page.sections.map(section => section.key)).size !== page.sections.length) context.addIssue({ code: 'custom', path: ['sections'], message: 'Chaque section doit avoir une identité distincte.' });
  if (page.slug === 'diagnostic-rps' && !page.sections.some(section => section.presentation === 'method' && section.items?.length === 5)) context.addIssue({ code: 'custom', path: ['sections'], message: 'Le Diagnostic doit conserver sa méthode en cinq étapes.' });
  if (page.slug === 'diagnostic-rps' && ['signaux', 'etapes', 'regards', 'livrables', 'confiance', 'questions', 'prevention'].some(key => !page.sections.some(section => section.key === key))) context.addIssue({ code: 'custom', path: ['sections'], message: 'Les sections essentielles du Diagnostic sont protégées ; leurs textes restent modifiables.' });
});
export const statisticSchema = z.object({ id: optionalId, value: required(80), label: required(800), source: required(300), sourceUrl: httpsUrl, year: required(150), note: required(2000), verified: z.boolean(), observationPeriod: optionalText(150), publicationYear: z.number().int().min(1900).max(2200).optional(), order: z.number().int().min(0).max(1000).optional() }).strict();
export const personSchema = z.object({ id: optionalId, name: required(150), role: required(600), bio: optionalText(8000), portrait: imageSchema.optional(), order: z.number().int().min(0).max(1000).optional() }).strict();
export const categorySchema = z.object({ id: optionalId, title: required(100), slug: slugSchema, description: optionalText(1000) }).strict();
export const settingsSchema = z.object({
  brand: z.literal('Calas Conseil'), tagline: z.literal('La voie de la qualité relationnelle.'), phone: z.string().regex(/^[+\d\s().-]{10,25}$/), email: z.string().email().max(254), linkedin: z.union([z.literal(''), httpsUrl.refine(value => /^https:\/\/(www\.)?linkedin\.com\//.test(value))]).optional(),
  qualification: z.object({ status: z.enum(['pending', 'verified']), label: optionalText(220), registration: optionalText(300), personId: optionalId, validUntil: z.string().date().optional() }).strict().refine(value => value.status !== 'verified' || Boolean(value.personId && value.label), 'Sélectionnez la titulaire et un libellé vérifié.'),
  footerText: optionalText(700), contactText: optionalText(1200),
}).strict();
const homeEditorial = z.object({
  heroAudience: optionalText(300), heroDisciplines: z.array(short(100)).max(8).optional(), heroArtTop: optionalText(180), heroArtBottom: optionalText(180), heroArtCaption: optionalText(300), exploreLabel: optionalText(120),
  statisticsEyebrow: optionalText(140), statisticsDescription: optionalText(1200), statisticsNote: optionalText(2000),
  diagnosticEyebrow: optionalText(140), diagnosticArtEyebrow: optionalText(140), diagnosticArtLegend: z.array(short(180)).max(8).optional(), diagnosticArtTitle: optionalText(220), diagnosticNote: optionalText(1000),
  reasonsEyebrow: optionalText(140), reasonsLink: ctaSchema.optional(), reasonsMotifLabel: optionalText(180), domainsEyebrow: optionalText(140), convictionEyebrow: optionalText(140),
}).strict();
export const homeSchema = z.object({
  eyebrow: required(180), title: required(350), intro: required(2500), primaryCta: ctaSchema, secondaryCta: ctaSchema,
  statistics: z.array(statisticSchema).max(4).default([]), statisticIds: z.array(uuid).max(4).optional(), statisticsTitle: optionalText(250), statisticsTransition: optionalText(1000),
  diagnostic: z.object({ title: required(250), text: required(2500), cta: ctaSchema, image: imageSchema.optional() }).strict(),
  reasons: z.array(item).length(3, 'L’accueil doit conserver ses trois raisons.'), reasonsTitle: optionalText(250), domainsTitle: optionalText(250), domainsIntro: optionalText(1200),
  conviction: z.object({ title: required(250), text: required(2500), cta: ctaSchema }).strict(), closingTitle: optionalText(250), closingCta: ctaSchema.optional(), seo: seoSchema.optional(), editorial: homeEditorial.optional(),
}).strict().superRefine((home, context) => {
  const keys = home.reasons.map(reason => reason.key).filter(Boolean);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: 'custom', path: ['reasons'], message: 'Chaque raison doit avoir une identité distincte.' });
  if (home.statisticIds && new Set(home.statisticIds).size !== home.statisticIds.length) context.addIssue({ code: 'custom', path: ['statisticIds'], message: 'Un chiffre ne peut apparaître deux fois.' });
});
export const articleSchema = z.object({
  title: required(250), slug: slugSchema, excerpt: short(700), body: richDocumentSchema,
  authorId: optionalId, categoryId: optionalId, date: z.string().datetime({ offset: true }).optional(), image: imageSchema.optional(), sourcePdf: fileSchema.optional(),
  allowPdfDownload: z.boolean().default(false), pdfImport: z.object({ pageCount: z.number().int().min(1).max(40), ocrPages: z.number().int().min(0).max(40), reviewed: z.boolean() }).strict().optional(), seo: seoSchema.optional(),
}).strict();
export type ArticleDraft = z.infer<typeof articleSchema>;
export const contentSchemas = { home: homeSchema, page: pageSchema, article: articleSchema, person: personSchema, statistic: statisticSchema, category: categorySchema, settings: settingsSchema };

export function parseContent(kind: ContentKind, input: unknown): Record<string, unknown> {
  // Bound structure before recursive schema parsing, including hostile deeply nested JSON.
  const pending: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++visited > 30_000 || depth > 32) throw new ContentError(422, 'CONTENT_LIMIT', 'Le contenu est trop volumineux ou trop imbriqué.');
    if (value && typeof value === 'object') for (const child of Object.values(value)) pending.push({ value: child, depth: depth + 1 });
  }
  const parsed = contentSchemas[kind].safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join('.') || 'content'] = issue.message;
    throw new ContentError(422, 'VALIDATION', 'Certains champs doivent être corrigés.', fields);
  }
  return parsed.data as Record<string, unknown>;
}

export function assertPublishable(kind: ContentKind, content: Record<string, unknown>): void {
  parseContent(kind, content);
  if (kind === 'article') {
    const article = content as ArticleDraft;
    const fields: Record<string, string> = {};
    if (!article.authorId) fields.authorId = 'Choisissez une auteure.';
    if (!article.categoryId) fields.categoryId = 'Choisissez une catégorie.';
    if (!article.date || new Date(article.date).getTime() > Date.now()) fields.date = 'Indiquez une date de publication qui ne soit pas dans le futur.';
    if (!article.excerpt.trim()) fields.excerpt = 'Ajoutez un résumé.';
    if (!hasRichContent(article.body)) fields.body = 'L’article ne contient pas encore de texte.';
    if ((article.pdfImport || article.sourcePdf) && !article.pdfImport?.reviewed) fields.pdfImport = 'Confirmez la relecture du document importé.';
    if (Object.keys(fields).length) throw new ContentError(422, 'PUBLICATION_INCOMPLETE', 'Complétez la relecture avant publication.', fields);
  }
  if (kind === 'statistic' && content.verified !== true) throw new ContentError(422, 'SOURCE_UNVERIFIED', 'Vérifiez la source avant de publier ce chiffre.');
}

export function hasRichContent(node: RichNode): boolean { return Boolean(node.text?.trim()) || node.type === 'image' || Boolean(node.content?.some(hasRichContent)); }
export function contentTitle(kind: ContentKind, content: Record<string, unknown>): string { return kind === 'settings' ? 'Paramètres du site' : kind === 'home' ? 'Accueil' : String(content.title || content.name || content.value || 'Sans titre').slice(0, 250); }
