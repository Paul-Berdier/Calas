import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { mkdir, mkdtemp, readFile, readdir, rmdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoContent } from '../apps/web/src/lib/cms/demo';
import { closeDatabase, getPool } from '../apps/web/src/server/db';
import { migrateDatabase } from '../apps/web/src/server/db/migrate';
import { createBackup, restoreBackup } from '../apps/web/src/server/content/backup';
import { encryptArchive, decryptArchive, hashFile, inspectArchive, type BackupManifest } from '../apps/web/src/server/content/backup-archive';
import { prepareSeedPlan } from '../apps/web/src/server/content/seed-plan';
import { createContent, getContent, isMediaPublished, listRevisions, publishContent, readSiteContent, saveContent, seedDocuments } from '../apps/web/src/server/content/repository';
import { S3MediaStorage } from '../apps/web/src/server/media/storage';

const root = fileURLToPath(new URL('../', import.meta.url));
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { S3Client, CreateBucketCommand, DeleteBucketCommand } = webRequire('@aws-sdk/client-s3') as typeof import('../apps/web/node_modules/@aws-sdk/client-s3');
try { loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url))); } catch { /* CI supplies environment. */ }

test('archive chiffrée : authentification et contrôle des empreintes avant extraction', async () => {
  await mkdir(join(root, 'backups', '.work'), { recursive: true });
  const directory = await mkdtemp(join(root, 'backups', '.work', 'archive-test-'));
  try {
    const key = randomBytes(32);
    const manifest: BackupManifest = { format: 'calas-backup-v1', createdAt: new Date().toISOString(), codeRevision: 'fixture', postgresVersion: '17', migrations: [], objectCount: 0, objects: [] };
    const manifestPath = join(directory, 'manifest.json'); await writeFile(manifestPath, JSON.stringify(manifest));
    const dump = join(directory, 'postgres.dump'); await writeFile(dump, 'Sensitive fixture, never a real password.');
    const archive = join(directory, 'valid.calas-backup');
    await encryptArchive(archive, [
      { kind: 'manifest', size: (await readFile(manifestPath)).length, sha256: await hashFile(manifestPath), path: manifestPath },
      { kind: 'postgres', size: (await readFile(dump)).length, sha256: await hashFile(dump), path: dump },
    ], key);
    assert.equal((await readFile(archive)).includes(Buffer.from('Sensitive fixture')), false);
    await assert.rejects(decryptArchive(archive, join(directory, 'wrong.records'), randomBytes(32)), /altérée|clé/);
    const changed = await readFile(archive); changed[changed.length - 1] ^= 1;
    const altered = join(directory, 'altered.calas-backup'); await writeFile(altered, changed);
    await assert.rejects(decryptArchive(altered, join(directory, 'altered.records'), key), /altérée|clé/);
    const plain = join(directory, 'valid.records'); await decryptArchive(archive, plain, key);
    const inspection = await inspectArchive(plain, index => join(directory, `verified-${index}.bin`));
    assert.equal(inspection.manifest.format, 'calas-backup-v1');
    assert.equal(await hashFile(inspection.records[1]!.path), await hashFile(dump));
  } finally { for (const name of await readdir(directory)) await unlink(join(directory, name)); await rmdir(directory); }
});

test('restauration réelle PostgreSQL et S3 dans deux destinations isolées', { skip: !process.env.DATABASE_URL || !process.env.S3_ENDPOINT || process.env.RUN_BACKUP_INTEGRATION !== '1', timeout: 180_000 }, async suite => {
  const originalUrl = process.env.DATABASE_URL!;
  const originalKey = process.env.BACKUP_ENCRYPTION_KEY;
  const suffix = randomUUID().replaceAll('-', '');
  const sourceDatabase = `calas_test_backup_${suffix}`;
  const targetDatabase = `calas_test_restore_${suffix}`;
  const sourceBucket = `calas-test-source-${suffix}`;
  const targetBucket = `calas-test-restore-${suffix}`;
  const archivePath = `backups/test-${suffix}.calas-backup`;
  const storageConfiguration = { endpoint: process.env.S3_ENDPOINT!, region: process.env.S3_REGION || 'auto', accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' };
  const client = new S3Client({ endpoint: storageConfiguration.endpoint, region: storageConfiguration.region, forcePathStyle: storageConfiguration.forcePathStyle, credentials: { accessKeyId: storageConfiguration.accessKeyId, secretAccessKey: storageConfiguration.secretAccessKey }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  const source = new S3MediaStorage({ ...storageConfiguration, bucket: sourceBucket });
  const target = new S3MediaStorage({ ...storageConfiguration, bucket: targetBucket });
  process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  process.env.SITE_ENV = 'test';
  let sourceCreated = false, targetCreated = false;
  try {
    await getPool().query(`CREATE DATABASE "${sourceDatabase}"`); sourceCreated = true;
    await getPool().query(`CREATE DATABASE "${targetDatabase}"`); targetCreated = true;
    await client.send(new CreateBucketCommand({ Bucket: sourceBucket }));
    await client.send(new CreateBucketCommand({ Bucket: targetBucket }));
    await closeDatabase();
    const url = new URL(originalUrl); url.pathname = `/${sourceDatabase}`; process.env.DATABASE_URL = url.toString();
    await migrateDatabase(join(root, 'drizzle'));
    await seedDocuments(prepareSeedPlan(demoContent).entries, { publish: true });
    const actor = { id: 'backup-test-admin', name: 'Administrateur de restauration', role: 'administrator' as const };
    await getPool().query('INSERT INTO auth_user (id,name,email,email_verified,role,two_factor_enabled) VALUES ($1,$2,$3,true,$4,true)', [actor.id, actor.name, 'backup-test@example.test', actor.role]);
    const bytes = await readFile(join(root, 'artifacts', 'pdf-import', 'fixtures', 'texte.pdf'));
    const mediaId = randomUUID(); const key = `media/${mediaId}/${randomUUID()}/original.pdf`;
    await source.put(key, bytes, 'application/pdf');
    await getPool().query('INSERT INTO media (id,storage_key,upload_key,original_filename,mime_type,size_bytes,metadata,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [mediaId, key, `backup:${mediaId}`, 'texte.pdf', 'application/pdf', bytes.length, { checksum: createHash('sha256').update(bytes).digest('hex') }, actor.id]);
    let category = await createContent('category', { title: 'Restauration de recette', slug: 'restauration-recette' }, actor); category = await publishContent(category.id, category.version, actor);
    const people = await getPool().query<{ id: string }>('SELECT id FROM people LIMIT 1');
    let article = await createContent('article', { title: 'Article sauvegardé', slug: 'article-sauvegarde', excerpt: 'Extrait de test', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Publication de recette.' }] }] }, authorId: people.rows[0]!.id, categoryId: category.id, date: '2020-01-01T00:00:00.000Z', sourcePdf: { mediaId }, allowPdfDownload: true, pdfImport: { pageCount: 1, ocrPages: 0, reviewed: true } }, actor);
    article = await publishContent(article.id, article.version, actor);
    article = await saveContent(article.id, { ...article.content, title: 'Brouillon conservé dans la sauvegarde' }, article.version, actor);
    const revisionCount = (await listRevisions(article.id)).length;
    let manifest: BackupManifest;
    await suite.test('pg_dump cohérent, données privées chiffrées et médias vérifiés', async () => {
      manifest = await createBackup(archivePath, source);
      assert.equal(manifest.objectCount, 1);
      assert.equal(manifest.objects[0]!.sha256, createHash('sha256').update(bytes).digest('hex'));
      const encrypted = await readFile(join(root, archivePath));
      assert.equal(encrypted.includes(Buffer.from(actor.name)), false);
      assert.equal(encrypted.includes(Buffer.from('Brouillon conservé')), false);
    });
    await closeDatabase(); url.pathname = `/${targetDatabase}`; process.env.DATABASE_URL = url.toString();
    await suite.test('archive corrompue refusée avant création de tables ou objets', async () => {
      const encrypted = await readFile(join(root, archivePath)); encrypted[encrypted.length - 3] ^= 1;
      const corrupted = `backups/corrupted-${suffix}.calas-backup`;
      try {
        await writeFile(join(root, corrupted), encrypted);
        await assert.rejects(restoreBackup(corrupted, target), /altérée|clé/);
        assert.equal((await target.list()).length, 0);
        const result = await getPool().query<{ count: string }>("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'");
        assert.equal(Number(result.rows[0]!.count), 0);
      } finally { await unlink(join(root, corrupted)); }
    });
    await suite.test('restauration des révisions, publications, accès et octets du PDF', async () => {
      const restored = await restoreBackup(archivePath, target);
      assert.equal(restored.objectCount, manifest.objectCount);
      assert.deepEqual(await target.get(key), new Uint8Array(bytes));
      assert.equal((await getContent(article.id)).content.title, 'Brouillon conservé dans la sauvegarde');
      assert.equal((await readSiteContent()).articles[0]!.title, 'Article sauvegardé');
      assert.equal((await listRevisions(article.id)).length, revisionCount);
      assert.equal(await isMediaPublished(mediaId, { download: true }), true);
      const user = await getPool().query<{ role: string }>('SELECT role FROM auth_user WHERE id = $1', [actor.id]);
      assert.equal(user.rows[0]!.role, 'administrator');
    });
    await suite.test('une seconde restauration refuse la destination non vide', async () => { await assert.rejects(restoreBackup(archivePath, target), /n’est pas vide/); });
  } finally {
    await closeDatabase(); process.env.DATABASE_URL = originalUrl;
    for (const [bucket, storage] of [[sourceBucket, source], [targetBucket, target]] as const) {
      try { const objects = await storage.list(); if (objects.length) await storage.remove(objects.map(object => object.key)); await client.send(new DeleteBucketCommand({ Bucket: bucket })); } catch { /* Preserve failure diagnostics from the test without exposing SDK credentials. */ }
    }
    if (sourceCreated) await getPool().query(`DROP DATABASE "${sourceDatabase}" WITH (FORCE)`);
    if (targetCreated) await getPool().query(`DROP DATABASE "${targetDatabase}" WITH (FORCE)`);
    await closeDatabase();
    await unlink(join(root, archivePath)).catch(() => undefined);
    if (originalKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY; else process.env.BACKUP_ENCRYPTION_KEY = originalKey;
  }
});
