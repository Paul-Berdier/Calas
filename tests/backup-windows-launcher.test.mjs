import {strict as assert} from 'node:assert';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmdirSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {deployedRevision, postgresUser, transportEnvironment} from '../scripts/backup-windows/railway-launch.mjs';

const marker = 'railway:e030d2f5-36b9-4fad-817d-7a146a3c3c31:cc59f611-8119-46f6-8f8d-d7c5d0d909a2:bfe26d62-f97f-45ab-ba63-afa9e8fbbad8';
const user = '12345678-1234-1234-1234-123456789abc';
const config = ['# BEGIN '+marker,'# Railway service: Postgres','Host calas-pg-backup','    HostName ssh.railway.com','    User '+user,'# END '+marker].join('\r\n');

test('SSH is bound to the intended project, environment, database service and gateway',()=>{
  assert.equal(postgresUser(config),user);
  for(const invalid of [config.replace('ssh.railway.com','other.tld'),config.replace(marker,'unrelated'),config.replace(user,'root'),config.replace('Host calas-pg-backup','Host another'),config.replace('    User ','    User extra\n    User ')]){
    assert.throws(()=>postgresUser(invalid));
  }
});

test('uses the most recent successful web deployment even during a new build',()=>{
  const current={status:'SUCCESS',meta:{commitHash:'1'.repeat(40)}};
  const older={status:'SUCCESS',meta:{commitHash:'2'.repeat(40)}};
  assert.equal(deployedRevision(JSON.stringify([{status:'DEPLOYING',meta:{commitHash:'3'.repeat(40)}},current,older])),current.meta.commitHash);
  assert.throws(()=>deployedRevision(JSON.stringify([{...current,meta:{}},older])));
  assert.throws(()=>deployedRevision('[]'));
});

test('SSH and Railway receive only local system environment variables',()=>{
  const system={Path:'bin',USERPROFILE:'operator',SystemRoot:'windows'};
  assert.deepEqual(transportEnvironment({...system,BACKUP_ENCRYPTION_KEY:'private',CALAS_BACKUP_PRIVATE_DATABASE_URL:'private',S3_SECRET_ACCESS_KEY:'private',RAILWAY_TOKEN:'private',NODE_OPTIONS:'private'}),system);
});

test('a pre-run configuration failure leaves a non-secret failure report and a failing exit code',t=>{
  const directory=mkdtempSync(join(tmpdir(),'calas-launch-report-'));
  const statusFile=join(directory,'latest.json');
  t.after(()=>{try{unlinkSync(statusFile);}finally{rmdirSync(directory);}});
  const source=fileURLToPath(new URL('../scripts/backup-windows/railway-launch.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[source],{env:{...transportEnvironment(process.env),CALAS_BACKUP_DIR:directory,CALAS_BACKUP_PRIVATE_DATABASE_URL:'sensitive-value'},encoding:'utf8'});
  assert.equal(result.status,1);
  const report=readFileSync(statusFile,'utf8');
  assert.equal(JSON.parse(report).stage,'launcher:configuration');
  assert.equal(JSON.parse(report).status,'failed');
  assert.doesNotMatch(report+result.stderr,/sensitive-value/);
});
