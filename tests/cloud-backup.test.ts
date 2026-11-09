import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { encryptArchive, hashFile } from '../apps/web/src/server/content/backup-archive';
import type { ArchiveStore, CloudBackupStatus } from '../apps/web/src/server/content/backup-destination';
import { captureCloudArchive } from '../scripts/cloud-backup';

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
