import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { closeDatabase, getPool } from '../apps/web/src/server/db';
import { createBackup, verifyBackup } from '../apps/web/src/server/content/backup';
import { backupKey, hashFile } from '../apps/web/src/server/content/backup-archive';
import { archiveDestination, writeBackupMonitorStatus, type ArchiveStore, type BackupStage, type CloudBackupStatus } from '../apps/web/src/server/content/backup-destination';
import { expiredDailyArchives } from '../apps/web/src/server/content/backup-retention';

export async function captureCloudArchive(store: ArchiveStore, capture: (path: string, directory: string) => Promise<unknown>, startedAt = new Date()) {
  const day = startedAt.toISOString().slice(0,10);
  const filename = `calas-daily-${day}.calas-backup`;
  const archive = 'daily/' + filename;
  const directory = await mkdtemp(join(tmpdir(), 'calas-cloud-backup-'));
  const local = join(directory, 'capture.calas-backup');
  const remote = join(directory, 'download.calas-backup');
  try {
    let reused = await store.download(archive, remote);
    let uploadedHash: string | undefined;
    if (!reused) {
      await capture(local, directory);
      const created = await verifyBackup(local, directory);
      if (new Date(created.createdAt).toISOString().slice(0,10) !== day) throw new Error('La date a changé pendant la capture.');
      const localHash = await hashFile(local);
      if (await store.uploadNew(archive, local)) uploadedHash = localHash;
      else reused = true; // A conditional write lost the race. Validate the winner's bytes.
      if (!await store.download(archive, remote)) throw new Error('Archive indisponible après son écriture.');
    }
    const sha256 = await hashFile(remote);
    if (uploadedHash && sha256 !== uploadedHash) throw new Error('La relecture distante diffère de la capture.');
    const manifest = await verifyBackup(remote, directory);
    const captureTime = new Date(manifest.createdAt);
    if (!Number.isFinite(+captureTime) || captureTime.toISOString().slice(0,10) !== day) throw new Error('La date du manifeste ne correspond pas au jour sauvegardé.');
    const files = await store.dailyFiles();
    if (!files.includes(filename)) throw new Error('La capture vérifiée manque dans l’inventaire distant.');
    for (const expired of expiredDailyArchives(files.filter(name => name <= filename))) await store.removeDaily(expired);
    const status: CloudBackupStatus = { status: 'ok', archive, sha256, bytes: (await stat(remote)).size, capturedAt: manifest.createdAt,
      objects: manifest.objectCount, finishedAt: new Date().toISOString(), reused };
    await store.markSuccess(status);
    return status;
  } finally {
    // This is a fresh process-owned temporary directory, never a configured path or shared volume.
    await rm(directory, { recursive: true, force: true });
  }
}

async function run() {
  process.umask(0o077);
  const deadline = setTimeout(() => {
    console.error('Sauvegarde interrompue après 50 minutes.');
    void writeBackupMonitorStatus({version: 1, failedAt: new Date().toISOString(), stage: 'delai'}).catch(() => {}).finally(() => process.exit(1));
  }, 50 * 60_000);
  deadline.unref();
  let stage: BackupStage = 'configuration';
  try {
    if (process.argv.length !== 2) throw new Error('Aucun argument attendu.');
    backupKey();
    // Railway injects the worker's commit. Only the web service's explicitly supplied revision belongs in the archive.
    const sourceRevision = process.env.BACKUP_SOURCE_REVISION || 'not-recorded';
    if (sourceRevision !== 'not-recorded' && !/^[a-f0-9]{40}$/.test(sourceRevision)) throw new Error('Révision web invalide.');
    const store = archiveDestination();
    stage = 'connexion-base';
    const client = await getPool().connect();
    try {
      const { rows: [state] } = await client.query('SELECT pg_try_advisory_lock(64236009) AS acquired');
      if (!state.acquired) { console.log('Une sauvegarde est déjà en cours.'); return; }
      stage = 'capture-distante';
      const status = await captureCloudArchive(store, (path, directory) => createBackup(path, undefined, { client, directory, sourceRevision }));
      stage = 'signalement';
      await writeBackupMonitorStatus({version: 1, day: status.capturedAt.slice(0,10), capturedAt: status.capturedAt, verifiedAt: status.finishedAt});
      console.log(JSON.stringify(status));
    } finally { client.release(true); }
  } catch {
    // Never log connection URLs, PostgreSQL diagnostics or provider errors.
    console.error(JSON.stringify({ status: 'failed', stage, finishedAt: new Date().toISOString() }));
    await writeBackupMonitorStatus({version: 1, failedAt: new Date().toISOString(), stage}).catch(() => {});
    process.exitCode = 1;
  } finally { clearTimeout(deadline); await closeDatabase(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void run();
