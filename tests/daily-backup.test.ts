import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, rmdir, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { backupKey, encryptArchive, hashFile, type BackupManifest } from '../apps/web/src/server/content/backup-archive';
import { captureDay, cleanInterruptedDailyWork, expiredDailyArchives } from '../scripts/daily-backup';

const archive = (day: string) => `calas-daily-${day}.calas-backup`;

test('interruption : reprend seulement les fichiers temporaires reconnus et ne traverse pas de jonction', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'calas-work-test-')));
  const work = join(root, '.work');
  await mkdir(work);
  const abandoned = await mkdtemp(join(work, 'daily-work-'));
  const changed = await mkdtemp(join(work, 'daily-work-'));
  const manual = await mkdtemp(join(work, 'backup-'));
  const external = await mkdtemp(join(root, 'external-'));
  const linked = join(work, 'daily-work-ZZzz00');
  const incomplete = join(work, 'pending-9a6966c7-fb6e-48b8-ad80-690ac896a24a.calas-backup');
  try {
    await writeFile(join(abandoned, 'postgres.dump'), 'partial');
    await writeFile(join(abandoned, 'object-0.bin'), 'partial');
    await writeFile(incomplete, 'partial');
    await writeFile(join(changed, 'postgres.dump'), 'keep');
    await writeFile(join(changed, 'unexpected.txt'), 'keep');
    await writeFile(join(manual, 'postgres.dump'), 'keep');
    await writeFile(join(external, 'manifest.json'), 'keep');
    await symlink(external, linked, process.platform === 'win32' ? 'junction' : 'dir');
    await cleanInterruptedDailyWork(root);
    assert(!(await readdir(work)).includes(abandoned.slice(work.length + 1)));
    await assert.rejects(stat(incomplete), { code: 'ENOENT' });
    assert.deepEqual((await readdir(changed)).sort(), ['postgres.dump', 'unexpected.txt']);
    assert.equal(await readFile(join(manual, 'postgres.dump'), 'utf8'), 'keep');
    assert.equal(await readFile(join(external, 'manifest.json'), 'utf8'), 'keep');
    assert.equal(await realpath(linked), external);
  } finally {
    await unlink(linked).catch(() => undefined);
    await unlink(incomplete).catch(() => undefined);
    for (const directory of [abandoned, changed, manual, external]) {
      const members = await readdir(directory).catch(() => [] as string[]);
      for (const name of members) await unlink(join(directory, name));
      await rmdir(directory).catch(() => undefined);
    }
    await rmdir(work);
    await rmdir(root);
  }
});

test('rotation : copies quotidiennes, hebdomadaires et mensuelles, conservation des sauvegardes manuelles', () => {
  const first = Date.UTC(2025, 0, 1);
  const dates = Array.from({ length: 480 }, (_, i) => new Date(first + i * 86_400_000).toISOString().slice(0, 10));
  const filenames = [...dates.map(archive), 'avant-migration.calas-backup', archive('2025-02-31')];
  const expired = new Set(expiredDailyArchives(filenames));
  for (const day of dates.slice(-30)) assert(!expired.has(archive(day)));
  // Latest in each of the twelve distinct months. With enough history, very old months expire.
  assert(!expired.has(archive('2025-05-31')));
  assert(expired.has(archive('2025-04-30')));
  // Sunday in an older retained week survives, adjacent ordinary day does not.
  assert(!expired.has(archive('2026-03-01')));
  assert(expired.has(archive('2026-03-02')));
  assert(!expired.has('avant-migration.calas-backup'));
  assert(!expired.has(archive('2025-02-31')));
});

test('capture journalière : contrôle intégral, reprise le même jour et protection de la copie antérieure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'calas-daily-test-'));
  await mkdir(join(directory, '.work'));
  const previousKey = process.env.BACKUP_ENCRYPTION_KEY;
  process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  try {
    const manifest: BackupManifest = { format: 'calas-backup-v1', createdAt: new Date().toISOString(), postgresVersion: '17', codeRevision: 'fixture', migrations: [], objectCount: 0, objects: [] };
    const manifestPath = join(directory, 'manifest.json');
    const dump = join(directory, 'postgres.dump');
    await writeFile(manifestPath, JSON.stringify(manifest));
    await writeFile(dump, 'PGDMPtest');
    const writeValid = async (path: string) => {
      await encryptArchive(path, [
        { kind: 'manifest', path: manifestPath, size: (await stat(manifestPath)).size, sha256: await hashFile(manifestPath) },
        { kind: 'postgres', path: dump, size: (await stat(dump)).size, sha256: await hashFile(dump) },
      ], backupKey());
    };
    const result = await captureDay(directory, '2026-11-09', writeValid);
    assert.equal(result.reused, false);
    const ciphertext = await readFile(join(directory, result.archive));
    const sameDay = await captureDay(directory, '2026-11-09', async () => { assert.fail('ne doit pas exporter à nouveau'); });
    assert.equal(sameDay.reused, true);
    assert.equal(sameDay.sha256, result.sha256);
    await assert.rejects(captureDay(directory, '2026-11-10', async path => {
      await writeValid(path);
      const tampered = await readFile(path);
      tampered[tampered.length - 1] ^= 1;
      await writeFile(path, tampered);
    }));
    assert.deepEqual(await readFile(join(directory, result.archive)), ciphertext);
    assert(!(await readdir(directory)).includes(archive('2026-11-10')));
    assert.deepEqual(await readdir(join(directory, '.work')), []);
  } finally {
    if (previousKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = previousKey;
    await rmdir(join(directory, '.work'));
    for (const name of await readdir(directory)) await unlink(join(directory, name));
    await rmdir(directory);
  }
});
