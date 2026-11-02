import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLinkedInArticleUrl } from '../apps/web/src/lib/article-links.ts';
import { linkedinArticles } from '../apps/web/src/lib/cms/linkedin-articles.ts';
import { demoContent } from '../apps/web/src/lib/cms/demo.ts';
import { assertPublishable, ContentError, parseContent } from '../apps/web/src/server/content/models.ts';
import { prepareSeedPlan, stableContentId } from '../apps/web/src/server/content/seed-plan.ts';

test('les liens de lecture acceptent uniquement les articles LinkedIn HTTPS sans identifiants', () => {
  for (const value of [
    'https://linkedin.com/pulse/article-valide/',
    'https://www.linkedin.com/pulse/article-valide/',
    'https://fr.linkedin.com/pulse/article-valide',
  ]) assert.equal(isLinkedInArticleUrl(value), true, value);
  for (const value of [
    undefined, '', 'javascript:alert(1)', 'http://www.linkedin.com/pulse/article/',
    'https://www.linkedin.com.evil.test/pulse/article/', 'https://evil.test/pulse/article/',
    'https://user:password@www.linkedin.com/pulse/article/', 'https://www.linkedin.com:444/pulse/article/',
    'https://www.linkedin.com/in/sara/', '//www.linkedin.com/pulse/article/',
    'https://www.linkedin.com/pulse/article/\n', 'https://www.linkedin.com\\@evil.test/pulse/article/',
    'https://www.linkedin.com/pulse/',
  ]) assert.equal(isLinkedInArticleUrl(value), false, String(value));
});

test('les cinq cartes ont une source, une auteure et une date sans texte intégral reconstitué', () => {
  const plan = prepareSeedPlan(demoContent);
  const entries = plan.entries.filter(entry => entry.kind === 'article');
  assert.equal(entries.length, 5);
  assert.equal(new Set(entries.map(entry => entry.id)).size, 5);
  for (const article of linkedinArticles) {
    const entry = entries.find(item => item.content.slug === article.slug);
    assert(entry);
    assert.equal(entry.content.externalUrl, article.externalUrl);
    assert.equal(entry.content.authorId, stableContentId('person', 'person-sara'));
    assert.equal(entry.content.date, article.date);
    assert.deepEqual(entry.content.body, { type: 'doc', content: [] });
    assert.equal(isLinkedInArticleUrl(entry.content.externalUrl), true);
    assert.doesNotThrow(() => assertPublishable('article', entry.content));
  }
});

test('le lien externe ne contourne pas les garde-fous de publication et le texte reste requis pour un article local', () => {
  const article = prepareSeedPlan(demoContent).entries.find(entry => entry.kind === 'article').content;
  assert.throws(() => parseContent('article', { ...article, externalUrl: 'https://elsewhere.test/' }), ContentError);
  assert.throws(() => assertPublishable('article', { ...article, authorId: undefined }), error => error instanceof ContentError && Boolean(error.fields?.authorId));
  assert.throws(() => assertPublishable('article', { ...article, categoryId: undefined }), error => error instanceof ContentError && Boolean(error.fields?.categoryId));
  assert.throws(() => assertPublishable('article', { ...article, externalUrl: undefined }), error => error instanceof ContentError && Boolean(error.fields?.body));
  assert.throws(() => assertPublishable('article', { ...article, date: '2199-01-01T00:00:00.000Z' }), error => error instanceof ContentError && Boolean(error.fields?.date));
  assert.throws(() => assertPublishable('article', { ...article, pdfImport: { pageCount: 1, ocrPages: 0, reviewed: false } }), error => error instanceof ContentError && Boolean(error.fields?.pdfImport));
});
