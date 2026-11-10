import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvFile } from 'node:process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { encryptArchive, hashFile } from '../apps/web/src/server/content/backup-archive';
import { archiveDestination, writeBackupMonitorStatus, type ArchiveStore, type CloudBackupStatus } from '../apps/web/src/server/content/backup-destination';
import { captureCloudArchive } from '../scripts/cloud-backup';

try { loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url))); } catch { /* CI supplies the local fixture environment. */ }

test('une archive distante est authentifiée avant rotation et peut être reprise sans nouvelle écriture', async () => {
  const previousKey = process.env.BACKUP_ENCRYPTION_KEY;
  process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  const startedAt = new Date('2026-11-10T06:00:00.000Z');
  const key = 'daily/calas-daily-2026-11-10.calas-backup';
  const archives = new Map<string,Buffer>();
  const states: CloudBackupStatus[] = [];
  const store: ArchiveStore = {
    async download(id,path) {
      const bytes = archives.get(id);
      if (!bytes) return false;
      await writeFile(path, bytes, { flag: 'wx' });
      return true;
    },
    async uploadNew(id,path) {
      if (archives.has(id)) return false;
      archives.set(id, await readFile(path));
      return true;
    },
    async dailyFiles() { return [...archives.keys()].map(id => id.slice('daily/'.length)); },
    async removeDaily() { assert.fail('Aucune archive ne doit expirer pendant cette recette.'); },
    async markSuccess(status) { states.push(status); },
  };
  const capture = async (path: string, directory: string) => {
    const dump = join(directory, 'pg.dump');
    const manifest = join(directory, 'manifest.json');
    await writeFile(dump, 'PGDMP-fixture');
    await writeFile(manifest, JSON.stringify({ format:'calas-backup-v1', createdAt:startedAt.toISOString(), postgresVersion:'17', codeRevision:'fixture', migrations:[], objectCount:0, objects:[] }));
    await encryptArchive(path, [
      {kind:'manifest',path:manifest,size:(await readFile(manifest)).length,sha256:await hashFile(manifest)},
      {kind:'postgres',path:dump,size:(await readFile(dump)).length,sha256:await hashFile(dump)},
    ]);
  };
  const mustReuse = async () => assert.fail('Une deuxième archive du même jour ne doit pas être créée.');
  try {
    const result = await captureCloudArchive(store, capture, startedAt);
    assert.equal(result.archive, key);
    assert.equal(result.reused, false);
    assert(!archives.get(key)!.includes(Buffer.from('PGDMP')));
    const original = Buffer.from(archives.get(key)!);
    const again = await captureCloudArchive(store, mustReuse, startedAt);
    assert.equal(again.reused, true);
    assert.equal(again.sha256, result.sha256);
    assert.deepEqual(archives.get(key), original);
    const bad = Buffer.from(original); bad[bad.length-1] ^= 1;
    archives.set(key, bad);
    await assert.rejects(captureCloudArchive(store, mustReuse, startedAt));
    assert.equal(states.length, 2);
    assert.deepEqual(archives.get(key), bad);
    archives.delete(key);
    const corruptingStore: ArchiveStore = { ...store, async uploadNew(id) { archives.set(id,bad); return true; } };
    await assert.rejects(captureCloudArchive(corruptingStore, capture, startedAt), /relecture distante/);
    assert.equal(states.length, 2);
  } finally {
    if (previousKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = previousKey;
  }
});

test('le stockage S3 local garde les archives immuables et sépare les signaux de succès et d’échec', {skip: process.env.CALAS_MEDIA_INTEGRATION !== 'yes'}, async () => {
  const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
  const { S3Client, CreateBucketCommand, DeleteBucketCommand, DeleteObjectsCommand, ListObjectsV2Command, GetObjectCommand } =
    require('@aws-sdk/client-s3') as typeof import('../apps/web/node_modules/@aws-sdk/client-s3');
  const endpoint = new URL(process.env.S3_ENDPOINT!);
  assert(['127.0.0.1', 'localhost', 'minio'].includes(endpoint.hostname));
  const client = new S3Client({endpoint: endpoint.href, region: process.env.S3_REGION, forcePathStyle: true,
    credentials: {accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!}});
  const archives = 'calas-test-archives-' + randomUUID();
  const signals = 'calas-test-signals-' + randomUUID();
  const previous = new Map<string,string | undefined>();
  const created: string[] = [];
  const directory = await mkdtemp(join(tmpdir(), 'calas-cloud-s3-'));
  function set(name: string, value: string) { previous.set(name,process.env[name]); process.env[name] = value; }
  try {
    set('SITE_ENV','test');
    for (const [prefix, bucket] of [['BACKUP_S3', archives], ['STATUS_S3', signals]] as const) {
      for (const field of ['ENDPOINT','ACCESS_KEY_ID','SECRET_ACCESS_KEY']) set(prefix + '_' + field,process.env['S3_' + field]!);
      set(prefix + '_REGION', process.env.S3_REGION || 'auto');
      set(prefix + '_FORCE_PATH_STYLE','true');
      set(prefix + '_BUCKET',bucket);
      await client.send(new CreateBucketCommand({Bucket: bucket})); created.push(bucket);
    }
    const store = archiveDestination();
    process.env.STATUS_S3_BUCKET = archives;
    try { assert.throws(archiveDestination, /distincts/); }
    finally { process.env.STATUS_S3_BUCKET = signals; }
    const key = 'daily/calas-daily-2026-11-10.calas-backup';
    const path = join(directory, 'input');
    const downloaded = join(directory, 'download');
    assert.equal(await store.download(key,downloaded), false);
    await writeFile(path,'first fixture');
    assert.equal(await store.uploadNew(key,path),true);
    await writeFile(path,'later fixture');
    assert.equal(await store.uploadNew(key,path),false);
    assert.equal(await store.download(key,downloaded),true);
    assert.equal(await readFile(downloaded,'utf8'),'first fixture');
    assert.deepEqual(await store.dailyFiles(),['calas-daily-2026-11-10.calas-backup']);
    const success = {version: 1 as const, day:'2026-11-10',capturedAt:'2026-11-10T06:00:00Z', verifiedAt:'2026-11-10T06:01:00Z'};
    const failure = {version: 1 as const, failedAt:'2026-11-10T06:02:00Z', stage:'capture-distante' as const};
    await writeBackupMonitorStatus(success);
    await writeBackupMonitorStatus(failure);
    for (const [name,expected] of [['success',success],['failure',failure]] as const) {
      const marker = await client.send(new GetObjectCommand({Bucket: signals, Key:'backup/' + name + '.json'}));
      assert.deepEqual(JSON.parse(await marker.Body!.transformToString()),expected);
    }
    assert.deepEqual((await client.send(new ListObjectsV2Command({Bucket:archives}))).Contents?.map(obj=>obj.Key),[key]);
  } finally {
    for (const [key, value] of previous) { if(value===undefined) delete process.env[key]; else process.env[key]=value; }
    try {
      for (const bucket of created) {
        const {Contents} = await client.send(new ListObjectsV2Command({Bucket:bucket}));
        if (Contents?.length) await client.send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:Contents.map(o=>({Key:o.Key!}))}}));
        await client.send(new DeleteBucketCommand({Bucket:bucket}));
      }
    } finally { client.destroy(); await rm(directory,{recursive:true,force:true}); }
  }
});
