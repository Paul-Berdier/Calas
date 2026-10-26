import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { demoContent } from '../apps/web/src/lib/cms/demo';
import { closeDatabase, getPool } from '../apps/web/src/server/db';
import { migrateDatabase } from '../apps/web/src/server/db/migrate';
import { ContentError, type EditorialActor } from '../apps/web/src/server/content/models';
import { prepareSeedPlan } from '../apps/web/src/server/content/seed-plan';
import { changePublication, createContent, dashboard, getContent, isMediaPublished, listContent, listRevisions, mediaIsReferenced, publishContent, readSiteContent, restoreContent, saveContent, seedDocuments } from '../apps/web/src/server/content/repository';

try { loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url))); } catch { /* CI supplies its own environment. */ }
const originalUrl = process.env.DATABASE_URL;
const admin: EditorialActor = { id: 'cms-test-admin', name: 'Administrateur de recette', role: 'administrator' };
const editor: EditorialActor = { id: 'cms-test-editor', name: 'Éditeur de recette', role: 'editor' };
const errorCode = (code: string) => (error: unknown) => error instanceof ContentError && error.code === code;

test('persistance PostgreSQL réelle, publication et isolation des révisions', { skip: !originalUrl, timeout: 120_000 }, async suite => {
  const databaseName = `calas_test_${randomUUID().replaceAll('-', '')}`;
  assert.match(databaseName, /^calas_test_[a-f0-9]{32}$/);
  await getPool().query(`CREATE DATABASE "${databaseName}"`);
  await closeDatabase();
  const isolated = new URL(originalUrl!);
  isolated.pathname = `/${databaseName}`;
  process.env.DATABASE_URL = isolated.toString();
  process.env.SITE_ENV = 'test';
  try {
    await migrateDatabase(fileURLToPath(new URL('../drizzle', import.meta.url)));
    for (const actor of [admin, editor]) await getPool().query('INSERT INTO auth_user (id,name,email,email_verified,role,two_factor_enabled) VALUES ($1,$2,$3,true,$4,true)', [actor.id, actor.name, `${actor.id}@example.test`, actor.role]);
    const plan = prepareSeedPlan(demoContent);
    await suite.test('initialisation idempotente sans remplacement des contenus', async () => {
      const first = await seedDocuments(plan.entries, { publish: true });
      assert.equal(first.filter(entry => entry.result === 'created').length, 17);
      const second = await seedDocuments(plan.entries, { publish: true });
      assert.equal(second.filter(entry => entry.result === 'skipped').length, 17);
      const publicContent = await readSiteContent();
      assert.equal(publicContent.pages.length, 9);
      assert.equal(publicContent.home.statistics.length, 4);
      assert.equal(publicContent.articles.length, 0);
      assert.equal(publicContent.home.title, demoContent.home.title);
    });
    const home = plan.entries.find(entry => entry.kind === 'home')!;
    await suite.test('enregistrer ne modifie pas le public et la publication est atomique', async () => {
      const before = await getContent(home.id);
      const originalTitle = (await readSiteContent()).home.title;
      const saved = await saveContent(home.id, { ...before.content, title: 'Titre de recette édité' }, before.version, admin);
      assert.equal((await readSiteContent()).home.title, originalTitle);
      assert.equal((await readSiteContent({ preview: true })).home.title, 'Titre de recette édité');
      await publishContent(home.id, saved.version, admin);
      assert.equal((await readSiteContent()).home.title, 'Titre de recette édité');
    });
    await suite.test('une version périmée ne peut écraser un brouillon', async () => {
      const before = await getContent(home.id);
      const results = await Promise.allSettled([
        saveContent(home.id, { ...before.content, title: 'Concurrent A' }, before.version, admin),
        saveContent(home.id, { ...before.content, title: 'Concurrent B' }, before.version, admin),
      ]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
      assert.equal((rejected.reason as ContentError).code, 'VERSION_CONFLICT');
    });
    await suite.test('restaurer crée une révision et conserve le public', async () => {
      const before = await getContent(home.id);
      const history = await listRevisions(home.id);
      const restored = await restoreContent(home.id, history.at(-1)!.id, before.version, admin);
      assert.equal(restored.content.title, demoContent.home.title);
      assert.equal((await readSiteContent()).home.title, 'Titre de recette édité');
      assert.equal((await listRevisions(home.id)).length, history.length + 1);
      await publishContent(home.id, restored.version, admin);
    });
    await suite.test('les instantanés sont immuables dans PostgreSQL', async () => {
      const detail = await getContent(home.id);
      await assert.rejects(getPool().query('UPDATE content_revisions SET content = $1 WHERE id = $2', [{ title: 'altération' }, detail.draftRevisionId]), (error: unknown) => (error as { code: string }).code === '23514');
      await assert.rejects(getPool().query('DELETE FROM content_revisions WHERE id = $1', [detail.draftRevisionId]), (error: unknown) => (error as { code: string }).code === '23514');
    });
    await suite.test('les paramètres refusent le rôle éditeur au niveau du service', async () => {
      const settings = plan.entries.find(entry => entry.kind === 'settings')!;
      const detail = await getContent(settings.id);
      await assert.rejects(saveContent(detail.id, { ...detail.content, phone: '0102030405' }, detail.version, editor), errorCode('ADMINISTRATOR_REQUIRED'));
    });
    await suite.test('une restauration ne peut emprunter la révision d’une autre ressource', async () => {
      const detail = await getContent(home.id);
      const settings = await getContent(plan.entries.find(entry => entry.kind === 'settings')!.id);
      await assert.rejects(restoreContent(detail.id, settings.draftRevisionId!, detail.version, admin), errorCode('REVISION_NOT_FOUND'));
    });
    await suite.test('les pointeurs SQL ne peuvent désigner la révision d’un autre document', async () => {
      const other = await getContent(plan.entries.find(entry => entry.kind === 'settings')!.id);
      await assert.rejects(getPool().query('UPDATE content_documents SET draft_revision_id = $1 WHERE id = $2', [other.draftRevisionId, home.id]), (error: unknown) => (error as { code: string }).code === '23503');
    });
    await suite.test('la relance du seed conserve les modifications éditoriales', async () => {
      const before = await getContent(home.id);
      await saveContent(home.id, { ...before.content, title: 'Texte de Sara conservé' }, before.version, admin);
      await seedDocuments(plan.entries, { publish: true });
      assert.equal((await getContent(home.id)).content.title, 'Texte de Sara conservé');
    });
    const author = plan.entries.find(entry => entry.kind === 'person')!;
    let category = await createContent('category', { title: 'Catégorie de recette', slug: 'categorie-recette' }, admin);
    category = await publishContent(category.id, category.version, admin);
    const pdfId = randomUUID();
    await getPool().query('INSERT INTO media (id,storage_key,upload_key,original_filename,mime_type,size_bytes,metadata,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [pdfId, `tests/${pdfId}.pdf`, `test:${pdfId}`, 'recette.pdf', 'application/pdf', 1000, { checksum: 'test-only' }, admin.id]);
    const articleInput = { title: 'Article de recette', slug: 'article-recette', excerpt: 'Extrait de recette', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texte de recette.' }] }] }, authorId: author.id, categoryId: category.id, date: '2020-01-01T00:00:00.000Z', sourcePdf: { mediaId: pdfId }, allowPdfDownload: true, pdfImport: { pageCount: 1, ocrPages: 0, reviewed: false } };
    let article = await createContent('article', articleInput, admin, { id: randomUUID() });
    await suite.test('répéter la création avec le même identifiant reste idempotent', async () => {
      const same = await createContent('article', articleInput, admin, { id: article.id });
      assert.equal(same.id, article.id);
      await assert.rejects(createContent('article', { ...articleInput, title: 'Autre' }, admin, { id: article.id }), errorCode('IDEMPOTENCY_CONFLICT'));
      assert.equal((await listContent('articles')).length, 1);
    });
    await suite.test('le PDF et l’article brouillons sont privés et la relecture bloque la publication', async () => {
      assert.equal((await readSiteContent()).articles.length, 0);
      assert.equal(await isMediaPublished(pdfId, { download: true }), false);
      assert.equal(await mediaIsReferenced(pdfId), true);
      await assert.rejects(publishContent(article.id, article.version, admin), errorCode('PUBLICATION_INCOMPLETE'));
      const unchanged = await getContent(article.id);
      assert.equal(unchanged.version, article.version);
    });
    await suite.test('publication du PDF autorisé, édition isolée et révocation à la dépublication', async () => {
      article = await saveContent(article.id, { ...article.content, pdfImport: { pageCount: 1, ocrPages: 0, reviewed: true } }, article.version, admin);
      article = await publishContent(article.id, article.version, admin);
      assert.equal((await readSiteContent()).articles[0]!.title, 'Article de recette');
      assert.equal(await isMediaPublished(pdfId, { download: true }), true);
      article = await saveContent(article.id, { ...article.content, title: 'Article modifié non publié' }, article.version, admin);
      assert.equal((await readSiteContent()).articles[0]!.title, 'Article de recette');
      article = await changePublication(article.id, article.version, admin, 'unpublish');
      assert.equal((await readSiteContent()).articles.length, 0);
      assert.equal(await isMediaPublished(pdfId, { download: true }), false);
    });
    await suite.test('un PDF non autorisé reste privé même après publication de l’article', async () => {
      article = await saveContent(article.id, { ...article.content, allowPdfDownload: false }, article.version, admin);
      article = await publishContent(article.id, article.version, admin);
      assert.equal(await isMediaPublished(pdfId), false);
      assert.equal((await readSiteContent()).articles[0]!.sourcePdf, undefined);
    });
    await suite.test('les liens utilisés, slugs uniques et médias historiques sont protégés', async () => {
      const person = await getContent(author.id);
      await assert.rejects(changePublication(person.id, person.version, admin, 'archive'), errorCode('CONTENT_IN_USE'));
      await assert.rejects(createContent('article', articleInput, admin), errorCode('DUPLICATE_SLUG'));
      await assert.rejects(getPool().query('DELETE FROM media WHERE id = $1', [pdfId]), (error: unknown) => (error as { code: string }).code === '23503');
    });
    await suite.test('les références inexistantes et les médias privés d’autrui sont refusés', async () => {
      await assert.rejects(createContent('article', { ...articleInput, slug: 'mauvais-auteur', authorId: randomUUID() }, admin), errorCode('MISSING_REFERENCE'));
      await assert.rejects(createContent('article', { ...articleInput, slug: 'media-prive' }, editor), errorCode('PRIVATE_MEDIA'));
    });
    await suite.test('les métriques du tableau de bord correspondent aux contenus persistés', async () => {
      const result = await dashboard();
      assert.equal(result.counts.pages, 10);
      assert.equal(result.counts.articlesPublished, 1);
      assert.equal(result.counts.media, 1);
      assert(result.recent.length > 0);
      assert(result.recentPublications.length > 0);
    });
  } finally {
    await closeDatabase();
    process.env.DATABASE_URL = originalUrl;
    await getPool().query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await closeDatabase();
  }
});
