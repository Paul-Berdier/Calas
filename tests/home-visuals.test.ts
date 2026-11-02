import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { demoContent } from '../apps/web/src/lib/cms/demo';
import { prepareSeedPlan } from '../apps/web/src/server/content/seed-plan';
import { ContentError, parseContent, type EditorialActor } from '../apps/web/src/server/content/models';
import { closeDatabase, getPool } from '../apps/web/src/server/db';
import { migrateDatabase } from '../apps/web/src/server/db/migrate';
import { getContent, isMediaPublished, mediaIsReferenced, publishContent, readSiteContent, saveContent, seedDocuments } from '../apps/web/src/server/content/repository';

const home = prepareSeedPlan(demoContent).entries.find(entry => entry.kind === 'home')!;
test('les dix visuels de l’accueil sont facultatifs et limités aux images de la médiathèque', () => {
  assert.equal(parseContent('home', home.content).visuals, undefined);
  const image = { mediaId: randomUUID(), alt: 'Un collectif échange pendant un atelier', width: 1600, height: 900 };
  const visuals = Object.fromEntries(['threads', 'nautilus', 'roots', 'compass', 'tree', 'kintsugi', 'ripples', 'murmuration', 'calmFace', 'closing'].map(name => [name, image]));
  assert.deepEqual(parseContent('home', { ...home.content, visuals }).visuals, visuals);
  for (const invalid of [{ arbitrary: image }, { closing: { ...image, src: 'https://remote.test/photo.jpg' } }, { closing: { ...image, mediaId: 'external-file' } }, { closing: { mediaId: image.mediaId } }]) {
    assert.throws(() => parseContent('home', { ...home.content, visuals: invalid }), ContentError);
  }
});

try { loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url))); } catch { /* CI supplies its own environment. */ }
const originalUrl = process.env.DATABASE_URL;
const originalEnvironment = process.env.SITE_ENV;
test('les visuels d’accueil conservent les droits privés, la publication explicite et les références historiques', { skip: !originalUrl, timeout: 120_000 }, async () => {
  const origin = new URL(originalUrl!);
  assert(['127.0.0.1', 'localhost', 'postgres'].includes(origin.hostname));
  const databaseName = `calas_visuals_test_${randomUUID().replaceAll('-', '')}`;
  assert.match(databaseName, /^calas_visuals_test_[a-f0-9]{32}$/);
  await getPool().query(`CREATE DATABASE "${databaseName}"`);
  await closeDatabase();
  const isolated = new URL(originalUrl!); isolated.pathname = `/${databaseName}`;
  process.env.DATABASE_URL = isolated.toString(); process.env.SITE_ENV = 'test';
  const administrator: EditorialActor = { id: 'visuals-admin', name: 'Recette visuels', role: 'administrator' };
  const editor: EditorialActor = { id: 'visuals-editor', name: 'Recette édition', role: 'editor' };
  const imageId = randomUUID(); const pdfId = randomUUID();
  try {
    await migrateDatabase(fileURLToPath(new URL('../drizzle', import.meta.url)));
    for (const actor of [administrator, editor]) await getPool().query('INSERT INTO auth_user (id,name,email,email_verified,role,two_factor_enabled) VALUES ($1,$2,$3,true,$4,true)', [actor.id, actor.name, `${actor.id}@example.test`, actor.role]);
    await seedDocuments(prepareSeedPlan(demoContent).entries, { publish: true });
    for (const [id, mime] of [[imageId, 'image/jpeg'], [pdfId, 'application/pdf']]) await getPool().query('INSERT INTO media (id,storage_key,upload_key,original_filename,mime_type,size_bytes,metadata,created_by,width,height) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id, `tests/${id}`, `test:${id}`, 'fixture', mime, 1000, { checksum: 'test-only' }, administrator.id, mime === 'image/jpeg' ? 1200 : null, mime === 'image/jpeg' ? 800 : null]);
    const initial = await getContent(home.id);
    const withImage = { ...initial.content, visuals: { calmFace: { mediaId: imageId, alt: 'Visage apaisé de recette' } } };
    const code = (expected: string) => (error: unknown) => error instanceof ContentError && error.code === expected;
    await assert.rejects(saveContent(home.id, withImage, initial.version, editor), code('PRIVATE_MEDIA'));
    await assert.rejects(saveContent(home.id, { ...initial.content, visuals: { closing: { mediaId: pdfId, alt: 'PDF refusé' } } }, initial.version, administrator), code('INVALID_IMAGE'));
    await assert.rejects(saveContent(home.id, { ...initial.content, visuals: { closing: { mediaId: randomUUID(), alt: 'Média absent' } } }, initial.version, administrator), code('MISSING_MEDIA'));
    const draft = await saveContent(home.id, withImage, initial.version, administrator);
    assert.equal(await isMediaPublished(imageId), false);
    assert.equal(await mediaIsReferenced(imageId), true);
    assert.equal((await readSiteContent()).home.visuals, undefined);
    assert.equal((await readSiteContent({ preview: true })).home.visuals?.calmFace?.mediaId, imageId);
    const published = await publishContent(home.id, draft.version, administrator);
    assert.equal(await isMediaPublished(imageId), true);
    assert.equal((await readSiteContent()).home.visuals?.calmFace?.mediaId, imageId);
    const removed = await saveContent(home.id, initial.content, published.version, administrator);
    assert.equal(await isMediaPublished(imageId), true, 'Un nouveau brouillon ne révoque pas la version publiée.');
    await publishContent(home.id, removed.version, administrator);
    assert.equal(await isMediaPublished(imageId), false);
    assert.equal(await mediaIsReferenced(imageId), true, 'Les révisions historiques protègent le média de la suppression.');
  } finally {
    await closeDatabase(); process.env.DATABASE_URL = originalUrl;
    if (originalEnvironment === undefined) delete process.env.SITE_ENV; else process.env.SITE_ENV = originalEnvironment;
    await getPool().query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await closeDatabase();
  }
});
