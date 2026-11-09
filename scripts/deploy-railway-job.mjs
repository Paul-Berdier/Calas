import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const jobs = {
  backup: {
    service: 'a9cf00aa-44e8-418a-a4ad-42dbf649f066',
    files: ['apps/web/src/server', 'scripts/cloud-backup.ts', 'drizzle', 'infra/backup'],
    schedule: '0 6 * * *',
  },
  monitor: {
    service: '90e3bca8-9717-4e63-9518-4a56237e48e4',
    files: ['infra/monitor'],
    schedule: '*/5 * * * *',
  },
};
const project = 'e030d2f5-36b9-4fad-817d-7a146a3c3c31';
const environment = 'cc59f611-8119-46f6-8f8d-d7c5d0d909a2';
const [name, sha, action] = process.argv.slice(2);
if (!Object.hasOwn(jobs, name) || !/^[0-9a-f]{40}$/.test(sha ?? '') || !['--check', '--deploy'].includes(action)) {
  throw new Error('Utiliser backup|monitor, le SHA Git complet et --check ou --deploy.');
}
const job = jobs[name];
const repo = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', ['-c', 'safe.directory=' + resolve(repo).replaceAll('\\', '/'), ...args], {
  cwd: repo, windowsHide: true, maxBuffer: 20 * 1024 * 1024,
});
if (git('rev-parse', '--verify', sha + '^{commit}').toString().trim() !== sha) throw new Error('Commit Git inconnu.');
const source = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'apps/web/package.json', ...job.files];
const entries = git('ls-tree', '--full-tree', '-r', '-z', sha, '--', ...source).toString('utf8').split('\0').filter(Boolean);
const temp = await realpath(tmpdir());
const bundle = await mkdtemp(join(temp, 'calas-railway-job-'));
try {
  for (const entry of entries) {
    const match = /^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/.exec(entry);
    if (!match) throw new Error('Type de fichier Git inattendu.');
    const [, , blob, path] = match;
    const destination = resolve(bundle, path);
    if (!destination.startsWith(bundle + sep) || path.split('/').some(piece => piece.startsWith('.env'))) {
      throw new Error('Chemin exclu du déploiement.');
    }
    await mkdir(dirname(destination), {recursive: true});
    await writeFile(destination, git('cat-file', 'blob', blob), {flag: 'wx'});
  }
  const folder = join(bundle, 'infra', name);
  const config = JSON.parse(await readFile(join(folder, 'railway.json'), 'utf8'));
  if (config.build?.dockerfilePath !== 'infra/' + name + '/Dockerfile' || config.deploy?.cronSchedule !== job.schedule
      || config.deploy.restartPolicyType !== 'NEVER' || config.deploy.healthcheckPath) throw new Error('Configuration cron incorrecte.');
  // Some Railway builders prefer the repository-root files over instance settings.
  // Both paths now select the exact same job, including on new services.
  await copyFile(join(folder, 'railway.json'), join(bundle, 'railway.json'));
  await copyFile(join(folder, 'Dockerfile'), join(bundle, 'Dockerfile'));
  console.log(JSON.stringify({job: name, commit: sha, files: entries.length, schedule: job.schedule, mode: action.slice(2)}));
  if (action === '--deploy') {
    const cli = process.platform === 'win32' ? join(process.env.APPDATA, 'npm/node_modules/@railway/cli/bin/railway.exe') : 'railway';
    execFileSync(cli, ['up', '.', '--path-as-root', '--project', project, '--environment', environment, '--service', job.service,
      '--detach', '--message', 'Calas ' + name + ' ' + sha], {cwd: bundle, windowsHide: true, stdio: 'inherit', timeout: 180_000});
  }
} finally {
  const target = await realpath(bundle);
  if (dirname(target) !== temp || !basename(target).startsWith('calas-railway-job-')) throw new Error('Chemin temporaire inattendu.');
  await rm(target, {recursive: true, force: true});
}
