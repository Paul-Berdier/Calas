import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoContent } from '../apps/web/src/lib/cms/demo';
import { assertPublishable, ContentError, parseContent, richDocumentSchema, safeEditorialUrl } from '../apps/web/src/server/content/models';
import { prepareSeedPlan, stableContentId } from '../apps/web/src/server/content/seed-plan';
import { convertPortableText } from '../apps/web/src/server/content/legacy-rich-text';

const id = stableContentId('media', 'fixture');
test('le plan initial conserve dix pages, deux personnes et quatre chiffres sans faux article', () => {
  const first = prepareSeedPlan(demoContent);
  assert.equal(first.entries.length, 17);
  assert.deepEqual(first, prepareSeedPlan(demoContent));
  assert.equal(first.entries.filter(entry => ['home', 'page'].includes(entry.kind)).length, 10);
  assert.equal(first.entries.filter(entry => entry.kind === 'article').length, 0);
  assert.equal(new Set(first.entries.map(entry => entry.id)).size, 17);
  assert.deepEqual(first.warnings, []);
  const diagnostic = first.entries.find(entry => entry.content.slug === 'diagnostic-rps')!;
  assert.equal((diagnostic.content.sections as Array<{ presentation?: string; items?: unknown[] }>).find(section => section.presentation === 'method')!.items!.length, 5);
});
test('les pages fixes, six blocs d’accueil et étapes du diagnostic ne peuvent être effacés', () => {
  const plan = prepareSeedPlan(demoContent);
  const home = plan.entries.find(entry => entry.kind === 'home')!;
  assert.throws(() => parseContent('home', { ...home.content, diagnostic: undefined }), ContentError);
  assert.throws(() => parseContent('home', { ...home.content, reasons: [] }), ContentError);
  const diagnostic = plan.entries.find(entry => entry.content.slug === 'diagnostic-rps')!;
  assert.throws(() => parseContent('page', { ...diagnostic.content, sections: [] }), ContentError);
});
test('la marque et la qualification sont validées côté serveur', () => {
  assert.throws(() => parseContent('settings', { ...demoContent.settings, brand: 'Calass' }), ContentError);
  assert.throws(() => parseContent('settings', { ...demoContent.settings, qualification: { status: 'verified' } }), ContentError);
});
test('les liens actifs et attributs arbitraires sont refusés', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,x', '//evil.test/', 'https://user:password@example.test/', '/\\evil', 'https://example.test/a\n']) assert.equal(safeEditorialUrl(href), false, href);
  for (const href of ['/contact/?objet=diagnostic', '#chiffres', 'https://example.test/', 'mailto:contact@example.test', 'tel:+33600000000']) assert.equal(safeEditorialUrl(href), true, href);
  assert.equal(richDocumentSchema.safeParse({ type: 'doc', content: [{ type: 'paragraph', attrs: { onclick: 'x' } }] }).success, false);
  assert.equal(richDocumentSchema.safeParse({ type: 'doc', content: [{ type: 'text', text: 'test', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }).success, false);
});
test('les images riches référencent seulement notre médiathèque', () => {
  assert.equal(richDocumentSchema.safeParse({ type: 'doc', content: [{ type: 'image', attrs: { mediaId: id, alt: 'Portrait' } }] }).success, true);
  assert.equal(richDocumentSchema.safeParse({ type: 'doc', content: [{ type: 'image', attrs: { mediaId: id, alt: 'Portrait', src: 'https://elsewhere.test/x.jpg' } }] }).success, false);
});
test('un article importé ne peut être publié sans auteur, catégorie, date et relecture', () => {
  const article = { title: 'Document de recette', slug: 'document-de-recette', excerpt: 'Extrait', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contenu' }] }] }, pdfImport: { pageCount: 1, ocrPages: 0, reviewed: false }, allowPdfDownload: false };
  assert.doesNotThrow(() => parseContent('article', article));
  assert.throws(() => assertPublishable('article', article), (error: unknown) => error instanceof ContentError && error.fields?.authorId !== undefined && error.fields?.pdfImport !== undefined);
  assert.doesNotThrow(() => assertPublishable('article', { ...article, authorId: id, categoryId: id, date: '2020-01-01T00:00:00.000Z', pdfImport: { ...article.pdfImport, reviewed: true } }));
});
test('la conversion historique préserve marques, titres, citations et listes imbriquées', () => {
  const block = (text: string, props = {}) => ({ _type: 'block', style: 'normal', children: [{ _type: 'span', text, marks: [] }], ...props });
  const result = convertPortableText([
    block('Titre', { style: 'h2' }), block('Premier', { listItem: 'bullet', level: 1 }), block('Sous-point', { listItem: 'bullet', level: 2 }), block('Second', { listItem: 'bullet', level: 1 }),
    block('Citation', { style: 'blockquote' }),
    block('Lien', { markDefs: [{ _key: 'link1', _type: 'link', href: 'https://example.test/' }], children: [{ _type: 'span', text: 'Texte lié', marks: ['strong', 'em', 'link1'] }] }),
  ]);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.document.content[0]!.type, 'heading');
  assert.equal(result.document.content[1]!.type, 'bulletList');
  assert.equal(result.document.content[1]!.content!.length, 2);
  assert.equal(result.document.content[1]!.content![0]!.content![1]!.type, 'bulletList');
  assert.equal(result.document.content[2]!.type, 'blockquote');
  assert.deepEqual(result.document.content[3]!.content![0]!.marks!.map(mark => mark.type), ['bold', 'italic', 'link']);
  assert.equal(richDocumentSchema.safeParse(result.document).success, true);
});
test('les éléments historiques non reconnus produisent un rapport et les images un repère visible', () => {
  const result = convertPortableText([{ _type: 'table' }, { _type: 'image', asset: { _ref: 'legacy-asset' } }, { _type: 'block', style: 'h1', children: [{ _type: 'span', text: 'Titre', marks: ['unknown'] }] }]);
  assert.equal(result.warnings.length, 4);
  assert.match(JSON.stringify(result.document), /Image à réimporter/);
});
