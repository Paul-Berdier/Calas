import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { link, lstat, mkdir, readdir, realpath, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { closeDatabase, getPool } from '../apps/web/src/server/db';
import { createBackup, verifyBackup } from '../apps/web/src/server/content/backup';
import { backupKey, hashFile } from '../apps/web/src/server/content/backup-archive';

const dailyName = /^calas-daily-(\d{4}-\d{2}-\d{2})\.calas-backup$/;
const temporaryDirectory = /^daily-work-[a-zA-Z0-9]{6}$/;
const temporaryFile = /^(postgres\.dump|manifest\.json|object-\d+\.bin|verified\.records|checked-\d+\.bin)$/;
const pendingFile = /^(pending-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.calas-backup|status-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json)$/;
const timezone = 'Europe/Paris';
const missingFile = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT';

function childEnvironment() {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ['SystemRoot', 'WINDIR', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'HOME', 'PROGRAMDATA', 'PATH', 'TEMP', 'TMP']) {
    if (process.env[name]) environment[name] = process.env[name];
  }
  return environment;
}

// lstat identifies symlinks/junctions. On NTFS also reject any other reparse tag, such as cloud placeholders.
async function noReparsePoints(paths: string[]) {
  if (process.platform !== 'win32' || !paths.length) return true;
  const powershell = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = [
    "$ErrorActionPreference='Stop'",
    '[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)',
    'foreach($p in (ConvertFrom-Json -InputObject ([Console]::In.ReadToEnd()))) { if ([IO.File]::GetAttributes($p) -band [IO.FileAttributes]::ReparsePoint) { exit 3 } }',
    'exit 0',
  ].join('; ');
  const processInfo = spawn(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, env: childEnvironment(), stdio: ['pipe', 'ignore', 'ignore'] });
  const result = new Promise<boolean>((done, fail) => {
    const failed = () => fail(new Error('Vérification des attributs NTFS impossible.'));
    processInfo.once('error', failed);
    processInfo.stdin.once('error', failed);
    processInfo.once('close', code => code === 0 ? done(true) : code === 3 ? done(false) : failed());
  });
  processInfo.stdin.end(JSON.stringify(paths));
  return result;
}

/** Called only under the daily job's advisory lock, on its own private directory. Never recurse. */
export async function cleanInterruptedDailyWork(directory: string) {
  const work = join(directory, '.work');
  if (!await noReparsePoints([directory, work]) || !(await lstat(work)).isDirectory() || await realpath(work) !== work) throw new Error('Dossier temporaire inattendu.');
  for (const entry of await readdir(work, { withFileTypes: true })) {
    const path = join(work, entry.name);
    if (pendingFile.test(entry.name) && entry.isFile() && await noReparsePoints([path]) && await realpath(path) === path) {
      await unlink(path);
      continue;
    }
    if (!temporaryDirectory.test(entry.name) || !entry.isDirectory() || !await noReparsePoints([path]) || await realpath(path) !== path) continue;
    const parts = await readdir(path, { withFileTypes: true });
    if (parts.some(part => !temporaryFile.test(part.name) || !part.isFile())) continue;
    const files = parts.map(part => join(path, part.name));
    if (!await noReparsePoints(files)) continue;
    let confined = true;
    for (const file of files) {
      if (await realpath(file) !== file) { confined = false; break; }
    }
    if (!confined) continue;
    for (const file of files) await unlink(file);
    await rmdir(path);
  }
}

function parisDay(date: Date) {
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Keep the newest capture in each of the most recent distinct weeks and months, in addition to daily copies. */
export function expiredDailyArchives(files: string[]): string[] {
  const entries = files.flatMap(name => {
    const day = dailyName.exec(name)?.[1];
    if (!day) return [];
    const date = new Date(day + 'T00:00:00Z');
    if (Number.isNaN(+date) || date.toISOString().slice(0, 10) !== day) return [];
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return [{ name, week: date.toISOString().slice(0, 10), month: day.slice(0, 7) }];
  }).sort((a, b) => b.name.localeCompare(a.name));
  const keep = new Set(entries.slice(0, 30).map(entry => entry.name));
  for (const key of ['week', 'month'] as const) {
    const seen = new Set<string>();
    for (const entry of entries) {
      if (seen.has(entry[key])) continue;
      seen.add(entry[key]);
      keep.add(entry.name);
      if (seen.size === 12) break;
    }
  }
  return entries.filter(entry => !keep.has(entry.name)).map(entry => entry.name);
}

async function prune(directory: string) {
  const files = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name);
  const expired = expiredDailyArchives(files);
  if (!await noReparsePoints(expired.map(name => join(directory, name)))) throw new Error('Point de réanalyse inattendu dans la rétention.');
  for (const name of expired) {
    const path = join(directory, name);
    if (dirname(await realpath(path)) !== directory || !(await lstat(path)).isFile()) throw new Error('Fichier de rétention inattendu.');
    await unlink(path);
  }
  return expired.length;
}

async function backupDirectory() {
  const input = process.env.CALAS_BACKUP_DIR;
  if (!input || !isAbsolute(input)) throw new Error('Un dossier de sauvegarde absolu est requis.');
  if (!await noReparsePoints([input]) || !(await lstat(input)).isDirectory()) throw new Error('Répertoire privé ordinaire attendu.');
  const directory = await realpath(input);
  const codeDirectory = await realpath(process.cwd());
  const route = relative(codeDirectory, directory);
  if (directory === dirname(directory) || !route || (!isAbsolute(route) && route !== '..' && !route.startsWith('..' + sep))) {
    throw new Error('Le dossier de sauvegarde doit être dédié et extérieur au code.');
  }
  if (!(await lstat(directory)).isDirectory()) throw new Error('Destination non valide.');
  const work = join(directory, '.work');
  await mkdir(work, { recursive: true, mode: 0o700 });
  if (!(await lstat(work)).isDirectory() || await realpath(work) !== work) throw new Error('Dossier de travail non valide.');
  return directory;
}

function sshSettings() {
  const user = process.env.CALAS_BACKUP_SSH_USER || '';
  const key = process.env.CALAS_BACKUP_SSH_KEY || '';
  const binary = process.env.CALAS_BACKUP_SSH_BIN || '';
  const database = new URL(process.env.DATABASE_URL || '');
  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(user) || !isAbsolute(key) || !isAbsolute(binary)) throw new Error('Configuration SSH incorrecte.');
  if (!['postgresql:', 'postgres:'].includes(database.protocol) || !['127.0.0.1', 'localhost'].includes(database.hostname) || database.username !== 'postgres' || database.pathname !== '/calas_staging') throw new Error('Tunnel PostgreSQL Calas attendu.');
  if (!process.env.CALAS_BACKUP_EXPECTED_BUCKET || process.env.CALAS_BACKUP_EXPECTED_BUCKET !== process.env.S3_BUCKET) throw new Error('Stockage Calas attendu.');
  backupKey();
  return { user, key, binary };
}

async function dumpRailwaySnapshot(snapshot: string, output: string) {
  if (!/^[0-9A-F]{1,16}-[0-9A-F]{1,16}-\d{1,16}$/i.test(snapshot)) throw new Error('Instantané PostgreSQL invalide.');
  const { binary, key, user } = sshSettings();
  const args = ['-T', '-i', key, '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=20', '-o', 'ServerAliveCountMax=3', user + '@ssh.railway.com',
    'pg_dump -U postgres -d calas_staging --format=custom --no-owner --no-privileges --snapshot=' + snapshot];
  // OpenSSH needs local paths and the user's known_hosts, never the database, bucket or archive credentials.
  const ssh = spawn(binary, args, { windowsHide: true, shell: false, env: childEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] });
  let diagnostic = false;
  ssh.stderr.on('data', () => { diagnostic = true; });
  const completion = new Promise<void>((done, fail) => {
    ssh.once('error', () => fail(new Error('Ouverture du tunnel de dump impossible.')));
    ssh.once('close', code => code === 0 && !diagnostic ? done() : fail(new Error('Échec du dump PostgreSQL distant.')));
  });
  const deadline = setTimeout(() => ssh.kill(), 15 * 60_000);
  try {
    await Promise.all([completion, pipeline(ssh.stdout, createWriteStream(output, { flags: 'wx', mode: 0o600 }))]);
  } finally { clearTimeout(deadline); if (ssh.exitCode === null) ssh.kill(); }
}

/** Promote a checked ciphertext without replacing an earlier verified copy. */
export async function captureDay(directory: string, day: string, writeArchive: (path: string) => Promise<unknown>) {
  const filename = `calas-daily-${day}.calas-backup`;
  if (!dailyName.test(filename)) throw new Error('Date non valide.');
  const target = join(directory, filename);
  const existing = await lstat(target).catch(error => { if (missingFile(error)) return null; throw error; });
  let manifest;
  if (existing) {
    if (!existing.isFile()) throw new Error('Destination non valide.');
    manifest = await verifyBackup(target, directory);
  } else {
    const pending = join(directory, '.work', `pending-${randomUUID()}.calas-backup`);
    try {
      await writeArchive(pending);
      manifest = await verifyBackup(pending, directory);
      await link(pending, target);
    } finally { await unlink(pending).catch(error => { if (!missingFile(error)) throw error; }); }
  }
  const checksum = await hashFile(target);
  const removed = await prune(directory);
  return { archive: filename, bytes: (await lstat(target)).size, sha256: checksum, capturedAt: manifest.createdAt, objects: manifest.objectCount, reused: Boolean(existing), removed };
}

async function publishStatus(directory: string, status: object) {
  const pending = join(directory, '.work', `status-${randomUUID()}.json`);
  try {
    await writeFile(pending, JSON.stringify(status, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(pending, join(directory, 'latest.json'));
  } finally { await unlink(pending).catch(error => { if (!missingFile(error)) throw error; }); }
}

async function main() {
  let directory: string | undefined;
  let stage = 'configuration';
  const startedAt = new Date();
  try {
    if (process.argv.length !== 2) throw new Error('Aucun argument attendu.');
    directory = await backupDirectory();
    sshSettings();
    stage = 'connexion-base';
    const client = await getPool().connect();
    try {
      const { rows: [check] } = await client.query('SELECT current_database() AS database, current_user AS owner, pg_try_advisory_lock(64236009) AS locked');
      if (!check.locked) { console.error('Une sauvegarde Calas est déjà en cours.'); process.exitCode = 2; return; }
      if (check.database !== 'calas_staging' || check.owner !== 'postgres') throw new Error('Base Calas inattendue.');
      stage = 'nettoyage-interruption';
      await cleanInterruptedDailyWork(directory);
      stage = 'capture-et-verification';
      await publishStatus(directory, { status: 'running', startedAt });
      const result = await captureDay(directory, parisDay(startedAt), path => createBackup(path, undefined, { client, directory, dumpSnapshot: dumpRailwaySnapshot }));
      const status = { status: 'ok', startedAt, finishedAt: new Date(), ...result };
      await publishStatus(directory, status);
      console.log(JSON.stringify(status));
    } finally { client.release(true); } // Closing the connection also releases the session lock on failure.
  } catch {
    const status = { status: 'failed', startedAt, finishedAt: new Date(), stage };
    if (directory) await publishStatus(directory, status).catch(() => undefined);
    console.error(JSON.stringify(status));
    process.exitCode = 1;
  } finally { await closeDatabase(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main();
