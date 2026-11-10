import {execFile, spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {access, realpath, rename, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const execute = promisify(execFile);
const project = 'e030d2f5-36b9-4fad-817d-7a146a3c3c31';
const environment = 'cc59f611-8119-46f6-8f8d-d7c5d0d909a2';
const postgres = 'bfe26d62-f97f-45ab-ba63-afa9e8fbbad8';
const web = '4811b664-6212-4cdf-a1b5-3f998d317367';
const gateway = 'ssh.railway.com';
const alias = 'calas-pg-backup';
const readyMarker = 'CALAS_BACKUP_FORWARD_READY';
const scope = ['--project',project,'--environment',environment];

// Railway authenticates with the operator's existing CLI session on disk.
// Never expose the database, S3 or encryption credentials to Railway or SSH.
export function transportEnvironment(input) {
  const systemKeys = new Set(['PATH','SYSTEMROOT','WINDIR','SYSTEMDRIVE','COMSPEC','PATHEXT','USERPROFILE','HOMEDRIVE','HOMEPATH','HOME','LOCALAPPDATA','APPDATA','PROGRAMDATA','TEMP','TMP','TMPDIR','LANG']);
  return Object.fromEntries(Object.entries(input).filter(([key])=>systemKeys.has(key.toUpperCase())));
}

export function postgresUser(config) {
  const marker = `railway:${project}:${environment}:${postgres}`;
  const lines = config.replace(/\r/g,'').trim().split('\n').map(line=>line.trim());
  if (lines[0] !== '# BEGIN ' + marker || lines.at(-1) !== '# END ' + marker) throw new Error('Identité du service SSH différente.');
  function one(key) {
    const values = lines.filter(line=>line.startsWith(key+' '));
    if (values.length !== 1) throw new Error('Configuration SSH inattendue.');
    return values[0].slice(key.length+1).trim();
  }
  const user = one('User');
  if (one('Host') !== alias || one('HostName') !== gateway || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(user)) throw new Error('Destination SSH inattendue.');
  return user;
}

export function deployedRevision(json) {
  // CLI 5.64 does not support --status here. It returns newest deployments first.
  const rows = JSON.parse(json);
  const live = rows.find(row=>row.status === 'SUCCESS');
  const sha = live?.meta?.commitHash;
  if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/i.test(sha)) throw new Error('Révision web active introuvable.');
  return sha;
}

function loopbackDatabase(raw, port) {
  const source = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(source.protocol) || !source.hostname.endsWith('.railway.internal') ||
      source.pathname !== '/calas_staging' || source.username !== 'postgres' || !source.password || (source.port && source.port !== '5432')) {
    throw new Error('Base de sauvegarde inattendue.');
  }
  const local = new URL('postgresql://127.0.0.1/calas_staging');
  local.username = source.username;
  local.password = source.password;
  local.port = String(port);
  if (source.searchParams.has('sslmode')) local.searchParams.set('sslmode', source.searchParams.get('sslmode'));
  return local.href;
}

async function localPort() {
  const server = createServer();
  const port = await new Promise((done, fail)=>{
    server.once('error',fail);
    server.listen(0,'127.0.0.1',()=>done(server.address().port));
  });
  await new Promise((done, fail)=>server.close(error=>error ? fail(error) : done()));
  return port;
}

function closeResult(child) {
  return new Promise(resolve=>{
    child.once('error',()=>resolve(-1));
    child.once('close',code=>resolve(code ?? -1));
  });
}

function waitForForward(child, closed) {
  return new Promise((done, fail)=>{
    let text = '';
    const timer = setTimeout(()=>finish(new Error('Délai de connexion SSH dépassé.')),30_000);
    function read(bytes) {
      text = (text+bytes.toString('utf8')).slice(-512);
      if (text.split(/\r?\n/).includes(readyMarker)) finish();
    }
    function finish(error) {
      clearTimeout(timer);
      child.stdout.off('data',read);
      if (error) fail(error); else done();
    }
    child.stdout.on('data',read);
    closed.then(()=>finish(new Error('Tunnel SSH fermé.')));
  });
}

async function recordFailure(directory, startedAt, stage) {
  const temporary = join(directory,'.launcher-'+randomUUID()+'.tmp');
  const data = {status:'failed',startedAt,finishedAt:new Date().toISOString(),stage};
  try {
    await writeFile(temporary,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
    await rename(temporary,join(directory,'latest.json'));
  } finally {
    await rm(temporary,{force:true});
  }
}

async function launch(env = process.env) {
  const startedAt = new Date().toISOString();
  const control = new AbortController();
  const children = new Map();
  const interrupt = ()=>control.abort();
  const stopChildren = ()=>{ for (const child of children.keys()) child.kill(); };
  for (const signal of ['SIGINT','SIGTERM','SIGHUP','SIGBREAK']) process.on(signal,interrupt);
  process.on('exit',stopChildren);
  let stage = 'launcher:configuration', directory;
  try {
    if (!isAbsolute(env.CALAS_BACKUP_DIR || '')) throw new Error('Répertoire privé requis.');
    directory = await realpath(env.CALAS_BACKUP_DIR);
    const railway=env.CALAS_RAILWAY_BIN, ssh=env.CALAS_BACKUP_SSH_BIN, key=env.CALAS_BACKUP_SSH_KEY;
    const runner = resolve('apps/web/src/server/content/daily-backup.mjs');
    if (![railway,ssh,key].every(value=>value && isAbsolute(value))) throw new Error('Chemins opérateur incomplets.');
    await Promise.all([railway,ssh,key,runner].map(path=>access(path)));
    if (!env.CALAS_BACKUP_EXPECTED_BUCKET || env.S3_BUCKET !== env.CALAS_BACKUP_EXPECTED_BUCKET) throw new Error('Bucket de sauvegarde inattendu.');
    const port = await localPort();
    const database = loopbackDatabase(env.CALAS_BACKUP_PRIVATE_DATABASE_URL,port);
    const system = transportEnvironment(env);
    const opts = {env:system,windowsHide:true,timeout:45_000,maxBuffer:16*1024*1024,signal:control.signal};
    stage = 'launcher:railway';
    const [config,deployments] = await Promise.all([
      execute(railway,['ssh','config',...scope,'--service',postgres,'--alias',alias,'--dry-run'],opts),
      execute(railway,['deployment','list',...scope,'--service',web,'--limit','100','--json'],opts),
    ]);
    const user = postgresUser(config.stdout);
    const revision = deployedRevision(deployments.stdout);
    stage = 'launcher:ssh';
    // The fixed LocalCommand runs only after a successful SSH authentication
    // and forward setup. A collision on the chosen port fails closed.
    const tunnel = spawn(ssh,[
      '-F','none','-N','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',
      '-o','IdentitiesOnly=yes','-o','ExitOnForwardFailure=yes','-o','ConnectTimeout=15',
      '-o','ServerAliveInterval=30','-o','ServerAliveCountMax=3',
      '-o','PermitLocalCommand=yes','-o','LocalCommand=echo '+readyMarker,
      '-i',key,'-L',`127.0.0.1:${port}:127.0.0.1:5432`,user+'@'+gateway
    ],{env:system,windowsHide:true,shell:false,stdio:['ignore','pipe','ignore'],signal:control.signal});
    const tunnelClosed = closeResult(tunnel);
    children.set(tunnel,tunnelClosed);
    await waitForForward(tunnel,tunnelClosed);
    stage = 'launcher:runner';
    const runnerEnv = {...system, DATABASE_URL:database, SOURCE_REVISION:revision, CALAS_BACKUP_SSH_USER:user,
      CALAS_BACKUP_SSH_BIN:ssh, CALAS_BACKUP_SSH_KEY:key, CALAS_BACKUP_DIR:directory,
      CALAS_BACKUP_EXPECTED_BUCKET:env.CALAS_BACKUP_EXPECTED_BUCKET, BACKUP_ENCRYPTION_KEY:env.BACKUP_ENCRYPTION_KEY};
    for (const name of ['S3_ENDPOINT','S3_REGION','S3_BUCKET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','S3_FORCE_PATH_STYLE']) runnerEnv[name]=env[name];
    const runnerProcess = spawn(process.execPath,[runner],{env:runnerEnv,windowsHide:true,shell:false,stdio:'ignore',signal:control.signal});
    const runnerClosed = closeResult(runnerProcess);
    children.set(runnerProcess,runnerClosed);
    const result = await Promise.race([runnerClosed,tunnelClosed.then(()=>-2)]);
    if (result !== 0) {
      if (result === -2) throw new Error('Tunnel interrompu pendant la sauvegarde.');
      // The runner writes its own stage and cause. Preserve that report if it
      // belongs to this attempt; a missing report must not leave yesterday green.
      throw new Error('Le programme de sauvegarde a échoué.');
    }
  } catch {
    if (directory) {
      let runnerReported = false;
      if (stage === 'launcher:runner') {
        try {
          const {readFile} = await import('node:fs/promises');
          const report = JSON.parse(await readFile(join(directory,'latest.json'),'utf8'));
          runnerReported = report.status === 'failed' && report.startedAt >= startedAt;
        } catch { /* No usable runner report. */ }
      }
      if (!runnerReported) await recordFailure(directory,startedAt,stage).catch(()=>{});
    }
    console.error('Sauvegarde Calas en échec ('+stage+').');
    process.exitCode = 1;
  } finally {
    control.abort();
    stopChildren();
    await Promise.all(children.values());
    process.off('exit',stopChildren);
    for (const signal of ['SIGINT','SIGTERM','SIGHUP','SIGBREAK']) process.off(signal,interrupt);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await launch();
