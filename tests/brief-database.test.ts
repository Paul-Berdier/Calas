import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { closeDatabase, getPool } from '../apps/web/src/server/db';
import { migrateDatabase } from '../apps/web/src/server/db/migrate';
import { createContent, getContent, publishContent, readSiteContent, seedDocuments } from '../apps/web/src/server/content/repository';
import { ContentError, type EditorialActor } from '../apps/web/src/server/content/models';
import { prepareSeedPlan } from '../apps/web/src/server/content/seed-plan';
import { briefChanges, importNewBriefPage, planBriefCorrection, previousBrief } from '../scripts/content-correct-brief-20261101';

try { loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url))); } catch { /* CI supplies its own environment. */ }
const originalUrl = process.env.DATABASE_URL;
test('la migration ajoute la nouvelle page protégée sans ouvrir la création publique des pages', { skip: !originalUrl, timeout: 120_000 }, async () => {
  const databaseName = `calas_test_${randomUUID().replaceAll('-', '')}`;
  assert.match(databaseName, /^calas_test_[a-f0-9]{32}$/);
  await getPool().query(`CREATE DATABASE "${databaseName}"`);
  await closeDatabase();
  const isolated = new URL(originalUrl!); isolated.pathname = `/${databaseName}`;
  process.env.DATABASE_URL = isolated.toString(); process.env.SITE_ENV = 'test';
  const actor: EditorialActor = { id: 'brief-test-admin', name: 'Recette du cahier', role: 'administrator' };
  try {
    await migrateDatabase(fileURLToPath(new URL('../drizzle', import.meta.url)));
    await getPool().query('INSERT INTO auth_user (id,name,email,email_verified,role,two_factor_enabled) VALUES ($1,$2,$3,true,$4,true)', [actor.id, actor.name, 'brief-test-admin@example.test', actor.role]);
    await seedDocuments(prepareSeedPlan(previousBrief).entries, { publish: true });
    const change = briefChanges.find(entry => !entry.before && entry.after.kind === 'page')!;
    const planned = planBriefCorrection(change);
    await assert.rejects(createContent('page', planned.content, actor), (error: unknown) => error instanceof ContentError && error.code === 'STRUCTURAL_CONTENT');
    await importNewBriefPage(change, planned.content);
    const detail = await getContent(change.after.id);
    assert.equal(detail.version, 1);
    assert.equal(detail.status, 'draft');
    assert.equal(detail.publishedRevisionId, null);
    const protectedFlag = await getPool().query<{ protected: boolean }>('SELECT protected FROM content_documents WHERE id=$1', [detail.id]);
    assert.equal(protectedFlag.rows[0]?.protected, true);
    assert.equal((await readSiteContent()).pages.some(page => page.slug === 'situations-sensibles'), false);
    await assert.rejects(importNewBriefPage(change, planned.content), /créée depuis/);
    await assert.rejects(importNewBriefPage(change, { ...planned.content, title: 'Un autre contenu' }), /limitée/);
    assert.deepEqual((await getContent(detail.id)).content, detail.content);
    await publishContent(detail.id, 1, actor);
    assert.equal((await readSiteContent()).pages.find(page => page.slug === 'situations-sensibles')?.title, planned.content.title);
    assert.equal(planBriefCorrection(change, (await getContent(detail.id)).content).changes.length, 0);
  } finally {
    await closeDatabase(); process.env.DATABASE_URL = originalUrl;
    await getPool().query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await closeDatabase();
  }
});
