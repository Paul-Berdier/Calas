import { createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { getPool } from '../db';
import { S3MediaStorage, type MediaStorage } from '../media/storage';
import { backupKey, decryptArchive, encryptArchive, hashFile, inspectArchive, type ArchiveRecord, type BackupManifest } from './backup-archive';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const exec = promisify(execFile);
const checksum = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const mimeType = (key: string) => key.endsWith('.pdf') ? 'application/pdf' : key.endsWith('.jpg') ? 'image/jpeg' : key.endsWith('.png') ? 'image/png' : 'image/webp';
const storageFromEnvironment = () => new S3MediaStorage({ endpoint: process.env.S3_ENDPOINT || '', region: process.env.S3_REGION || 'auto', bucket: process.env.S3_BUCKET || '', accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '', forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' });

export function backupPath(path: string): string {
  const directory = resolve(root, 'backups');
  const destination = resolve(root, path);
  if (!destination.startsWith(directory + sep) || !destination.endsWith('.calas-backup')) throw new Error('Choisissez un fichier .calas-backup dans le dossier privé backups/.');
  return destination;
}
async function workDirectory() { const parent = resolve(root, 'backups', '.work'); await mkdir(parent, { recursive: true, mode: 0o700 }); return mkdtemp(join(parent, 'backup-')); }
async function cleanup(directory: string) {
  const expected = resolve(root, 'backups', '.work') + sep;
  if (!directory.startsWith(expected)) throw new Error('Répertoire temporaire inattendu.');
  for (const name of await readdir(directory)) { const path = join(directory, name); if ((await stat(path)).isFile()) await unlink(path); else throw new Error('Sous-dossier temporaire inattendu.'); }
  await rmdir(directory);
}

async function postgresTool(tool: 'pg_dump' | 'pg_restore', args: string[], options: { output?: string; input?: string }) {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('La connexion PostgreSQL est invalide.');
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-zA-Z0-9_-]+$/.test(database)) throw new Error('Le nom de la base contient des caractères non pris en charge par les outils de sauvegarde.');
  const container = process.env.BACKUP_POSTGRES_CONTAINER;
  let command = process.env.POSTGRES_BIN ? join(process.env.POSTGRES_BIN, process.platform === 'win32' ? `${tool}.exe` : tool) : tool;
  let commandArgs = ['--dbname', database, ...args];
  const environment = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: database, PGSSLMODE: url.searchParams.get('sslmode') || 'prefer' };
  if (container) {
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/.test(container)) throw new Error('Le mode Docker est réservé au conteneur local de recette.');
    const port = await exec('docker', ['inspect', '--format', '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', container], { windowsHide: true });
    if (port.stdout.trim() !== (url.port || '5432')) throw new Error('Le conteneur ne correspond pas au port PostgreSQL configuré.');
    command = 'docker'; commandArgs = ['exec', '-i', container, tool, '-U', decodeURIComponent(url.username), '-d', database, ...args];
  }
  const child = spawn(command, commandArgs, { shell: false, windowsHide: true, env: environment, stdio: ['pipe', 'pipe', 'pipe'] });
  // stderr is intentionally not forwarded: PostgreSQL may include data in diagnostics.
  let diagnostics = false;
  child.stderr.on('data', () => { diagnostics = true; });
  const completion = new Promise<void>((resolvePromise, reject) => {
    child.once('error', () => reject(new Error(`${tool} est introuvable ou ne peut pas démarrer.`)));
    child.once('exit', code => code === 0 ? resolvePromise() : reject(new Error(`${tool} a échoué ; aucune sortie contenant des données n’a été journalisée.`)));
  });
  const timeout = setTimeout(() => child.kill(), 15 * 60_000);
  try {
    const operations: Promise<unknown>[] = [completion];
    if (options.output) operations.push(pipeline(child.stdout, createWriteStream(options.output, { flags: 'wx', mode: 0o600 }))); else child.stdout.resume();
    if (options.input) operations.push(pipeline(createReadStream(options.input), child.stdin)); else child.stdin.end();
    const results = await Promise.allSettled(operations);
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    if (diagnostics && tool === 'pg_dump') throw new Error('pg_dump a produit un avertissement. La sauvegarde doit être examinée avant validation.');
  } finally { clearTimeout(timeout); if (child.exitCode === null) child.kill(); }
}

export async function createBackup(path: string, storage: MediaStorage = storageFromEnvironment()): Promise<BackupManifest> {
  const target = backupPath(path);
  const key = backupKey();
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  const directory = await workDirectory();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    // Prevent deletion/replacement of metadata while pg_dump and the object inventory are captured.
    await client.query('LOCK TABLE media, media_deletions IN SHARE MODE');
    const { rows: snapshot } = await client.query<{ snapshot: string }>('SELECT pg_export_snapshot() AS snapshot');
    const { rows: version } = await client.query<{ server_version: string }>('SHOW server_version');
    const dump = join(directory, 'postgres.dump');
    await postgresTool('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--snapshot=${snapshot[0]!.snapshot}`], { output: dump });
    const objects = await storage.list();
    if ((await stat(dump)).size > 2 * 1024 ** 3 || objects.reduce((size, object) => size + object.size + 16_384, (await stat(dump)).size) > 5 * 1024 ** 3) throw new Error('Le volume dépasse la limite du format de sauvegarde ; aucune archive complète ne sera annoncée.');
    const { rows: mediaRows } = await client.query<{ storage_key: string; metadata: { variants?: Array<{ key: string }>; retiredKeys?: string[] } }>('SELECT storage_key, metadata FROM media');
    const present = new Set(objects.map(object => object.key));
    for (const asset of mediaRows) for (const required of [asset.storage_key, ...(asset.metadata.variants || []).map(variant => variant.key), ...(asset.metadata.retiredKeys || [])]) if (!present.has(required)) throw new Error('Un média référencé manque dans le stockage ; sauvegarde interrompue.');
    const objectRecords: ArchiveRecord[] = [];
    for (const object of objects.sort((a, b) => a.key.localeCompare(b.key))) {
      const bytes = await storage.get(object.key);
      if (bytes.length !== object.size) throw new Error('Un objet a changé pendant la sauvegarde.');
      const objectPath = join(directory, `object-${objectRecords.length}.bin`);
      await writeFile(objectPath, bytes, { flag: 'wx', mode: 0o600 });
      objectRecords.push({ kind: 'object', key: object.key, size: bytes.length, mimeType: mimeType(object.key), sha256: checksum(bytes), path: objectPath });
    }
    await client.query('COMMIT');
    const migrationDirectory = join(root, 'drizzle');
    const migrations = await Promise.all((await readdir(migrationDirectory)).filter(name => name.endsWith('.sql')).sort().map(async name => ({ name, sha256: await hashFile(join(migrationDirectory, name)) })));
    let codeRevision = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.SOURCE_REVISION || 'not-recorded';
    if (codeRevision === 'not-recorded') { try { codeRevision = (await exec('git', ['-c', `safe.directory=${root.replaceAll('\\', '/').replace(/\/$/, '')}`, 'rev-parse', 'HEAD'], { cwd: root, windowsHide: true })).stdout.trim(); } catch { /* Deployment may not include .git. */ } }
    const manifest: BackupManifest = { format: 'calas-backup-v1', createdAt: new Date().toISOString(), codeRevision, migrations, postgresVersion: version[0]!.server_version, objectCount: objectRecords.length, objects: objectRecords.map(({ key: objectKey, size, sha256, mimeType: type }) => ({ key: objectKey!, size, sha256, mimeType: type! })) };
    const manifestPath = join(directory, 'manifest.json'); await writeFile(manifestPath, JSON.stringify(manifest), { flag: 'wx', mode: 0o600 });
    await encryptArchive(target, [
      { kind: 'manifest', size: (await stat(manifestPath)).size, sha256: await hashFile(manifestPath), path: manifestPath },
      { kind: 'postgres', size: (await stat(dump)).size, sha256: await hashFile(dump), path: dump }, ...objectRecords,
    ], key);
    return manifest;
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); await cleanup(directory); }
}

export async function restoreBackup(path: string, storage: MediaStorage = storageFromEnvironment()): Promise<BackupManifest> {
  if (!['test', 'staging', 'development'].includes(process.env.SITE_ENV || '')) throw new Error('Restaurez dans un environnement isolé de test ou préproduction avant toute bascule.');
  const url = new URL(process.env.DATABASE_URL || '');
  if (!/(test|restore|staging)/.test(url.pathname)) throw new Error('La base de destination doit être explicitement nommée test, restore ou staging.');
  const source = backupPath(path);
  const directory = await workDirectory();
  const client = await getPool().connect();
  const uploaded: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended('calas-restore', 0))");
    const { rows } = await client.query<{ count: string }>("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','v','m','S')");
    if (Number(rows[0]!.count) !== 0) throw new Error('Restauration refusée : la base de destination n’est pas vide.');
    if ((await storage.list()).length !== 0) throw new Error('Restauration refusée : le bucket de destination n’est pas vide.');
    const plain = join(directory, 'decrypted.records');
    await decryptArchive(source, plain);
    const { records, manifest } = await inspectArchive(plain, index => join(directory, `record-${index}.bin`));
    for (const record of records.filter(record => record.kind === 'object')) {
      await storage.put(record.key!, await readFile(record.path), record.mimeType!);
      uploaded.push(record.key!);
      if (checksum(await storage.get(record.key!)) !== record.sha256) throw new Error('Le média restauré ne correspond pas à son empreinte.');
    }
    await postgresTool('pg_restore', ['--single-transaction', '--exit-on-error', '--no-owner', '--no-privileges'], { input: records[1]!.path });
    return manifest;
  } catch (error) {
    // The destination was empty and PostgreSQL restore is transactional; remove only our own uploads.
    for (let index = 0; index < uploaded.length; index += 500) await storage.remove(uploaded.slice(index, index + 500)).catch(() => undefined);
    throw error;
  } finally { await client.query("SELECT pg_advisory_unlock(hashtextextended('calas-restore', 0))").catch(() => undefined); client.release(); await cleanup(directory); }
}

export function defaultBackupFilename() { return `backups/calas-${new Date().toISOString().replace(/[:.]/g, '-')}.calas-backup`; }
export const describeBackup = (manifest: BackupManifest) => ({ createdAt: manifest.createdAt, objects: manifest.objectCount, postgresVersion: manifest.postgresVersion, codeRevision: manifest.codeRevision, migrations: manifest.migrations.map(migration => basename(migration.name)) });
