import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {basename, dirname, resolve} from 'node:path';
import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import {provisionProductionAccounts, productionIdentities, validateProvisionConfiguration} from '../scripts/auth-provision-production-20261103';
import {getPool, closeDatabase} from '../apps/web/src/server/db';
import {migrateDatabase} from '../apps/web/src/server/db/migrate';
import {createAuth} from '../apps/web/src/server/auth';
import {requireEditor} from '../apps/web/src/server/auth/permissions';

const origin = 'https://calas-conseil.fr';
const root = fileURLToPath(new URL('../',import.meta.url));
const options = {apply:false,expectedOrigin:origin,expectedDatabase:'isolated',operatorId:'operator'};
const validEnv = {DATABASE_URL:'postgres://localhost/isolated',SITE_ENV:'staging',SITE_URL:origin,BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:'x'.repeat(32),AUTH_MAIL_TRANSPORT:'local',AUTH_SMTP_HOST:'127.0.0.1',AUTH_SMTP_PORT:'11025',AUTH_SMTP_FROM:'test@example.test',ALLOW_REAL_EMAIL:'false'};

test('production provisioning refuses wrong origins and all external mail before connecting', async () => {
  validateProvisionConfiguration(options,validEnv);
  validateProvisionConfiguration({...options,expectedOrigin:'https://www.calas-conseil.fr'},{...validEnv,SITE_URL:'https://www.calas-conseil.fr',BETTER_AUTH_URL:'https://www.calas-conseil.fr'});
  for (const changed of [
    {SITE_ENV:'production'}, {AUTH_MAIL_TRANSPORT:'smtp'}, {AUTH_SMTP_HOST:'smtp.example.com'},
    {ALLOW_REAL_EMAIL:'true'}, {SITE_URL:'https://wrong.example'}, {BETTER_AUTH_URL:'https://wrong.example'},
  ]) assert.throws(() => validateProvisionConfiguration(options,{...validEnv,...changed}));
  assert.throws(() => validateProvisionConfiguration({...options,expectedOrigin:'https://wrong.example'},validEnv));
  assert.throws(() => validateProvisionConfiguration({...options,apply:true,outputFile:'public/passwords.json'},validEnv));
  assert.throws(() => validateProvisionConfiguration({...options,apply:true,outputFile:resolve(root,'apps/web/public/passwords.json')},validEnv));
});

try {loadEnvFile(fileURLToPath(new URL('../apps/web/.env',import.meta.url)));} catch { /* CI supplies env. */ }
const source = process.env.DATABASE_URL;
test('provisioning preserves roles, histories and verification/MFA boundaries in an isolated database', {skip:!source,timeout:120_000}, async () => {
  assert(['localhost','127.0.0.1'].includes(new URL(source!).hostname),'Local database only');
  const initialEnv = {...process.env};
  const database = `calas_provision_test_${randomUUID().replaceAll('-','')}`;
  assert.match(database,/^calas_provision_test_[a-f0-9]{32}$/);
  const directory = await mkdtemp(resolve(root,'.cache','auth-production-test-'));
  const outputFile = resolve(directory,'credentials.json');
  const messagesBefore = new Set<string>((await (await fetch('http://127.0.0.1:18025/api/v1/messages')).json()).messages.map((row:{ID:string}) => row.ID));
  const messageIds: string[] = [];
  await getPool().query(`CREATE DATABASE "${database}"`);
  await closeDatabase();
  const isolated = new URL(source!);isolated.pathname = `/${database}`;
  Object.assign(process.env,{...validEnv,DATABASE_URL:isolated.href});
  const operatorId = `operator-${randomUUID()}`;
  const configuration = {apply:false,expectedOrigin:origin,expectedDatabase:database,operatorId,outputFile};
  try {
    await migrateDatabase(fileURLToPath(new URL('../drizzle',import.meta.url)));
    await getPool().query('INSERT INTO auth_user(id,name,email,email_verified,role) VALUES ($1,$2,$3,true,$4)',[operatorId,'Existing operator','operator@example.test','administrator']);
    const before = (await getPool().query('SELECT * FROM auth_user ORDER BY id')).rows;
    await assert.rejects(provisionProductionAccounts({...configuration,expectedDatabase:'wrong'}),/Destination/);
    await assert.rejects(provisionProductionAccounts({...configuration,operatorId:'missing'}),/Opérateur/);
    assert.equal((await provisionProductionAccounts(configuration)).applied,false);
    assert.deepEqual((await getPool().query('SELECT * FROM auth_user ORDER BY id')).rows,before);
    const result = await provisionProductionAccounts({...configuration,apply:true});
    assert.equal(result.applied,true);
    const handoff = JSON.parse(await readFile(outputFile,'utf8'));
    assert.equal(handoff.accounts.length,3);
    assert.equal(new Set(handoff.accounts.map((account:{password:string})=>account.password)).size,3);
    assert(handoff.accounts.every((account:{password:string})=>account.password.length>=32));
    const stored = (await getPool().query('SELECT id,email,role,email_verified,two_factor_enabled,disabled FROM auth_user WHERE id<>$1 ORDER BY email',[operatorId])).rows;
    assert.equal(stored.length,3);
    for (const identity of productionIdentities) {
      const row = stored.find(row=>row.email===identity.email);
      assert(row && row.role===identity.role && !row.email_verified && !row.two_factor_enabled && !row.disabled);
    }
    assert.deepEqual((await getPool().query('SELECT * FROM auth_user WHERE id=$1',[operatorId])).rows,before);
    const credentialHashes = (await getPool().query("SELECT password FROM auth_account WHERE provider_id='credential'")).rows;
    assert.equal(credentialHashes.length,3);
    assert(credentialHashes.every(row=>!handoff.accounts.some((account:{password:string})=>account.password===row.password)));
    await assert.rejects(provisionProductionAccounts({...configuration,apply:true,outputFile:resolve(directory,'second.json')}),/existe/);

    const auth = createAuth();
    for (const account of handoff.accounts) {
      await assert.rejects(auth.api.signInEmail({body:{email:account.email,password:account.password}}));
    }
    const messages = (await (await fetch('http://127.0.0.1:18025/api/v1/messages')).json()).messages.filter((row:{ID:string})=>!messagesBefore.has(row.ID));
    for (const account of handoff.accounts) {
      const matching = messages.filter((row:{ID:string;To:Array<{Address:string}>})=>row.To.some(to=>to.Address===account.email));
      assert.equal(matching.length,1,'Exactly one local verification message per account');
      messageIds.push(matching[0].ID);
      const message = await (await fetch(`http://127.0.0.1:18025/api/v1/message/${matching[0].ID}`)).json();
      const link = message.Text.match(/https:\/\/[^\s]+/)?.[0];
      assert(link && new URL(link).origin===origin);
      const token = new URL(link).searchParams.get('token');assert(token);
      await auth.api.verifyEmail({query:{token}});
      const login = await auth.api.signInEmail({body:{email:account.email,password:account.password},returnHeaders:true});
      const cookies = login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
      await assert.rejects(requireEditor(new Request(`${origin}/api/admin/content/pages/`,{headers:{cookie:cookies}})),(error:unknown)=>Boolean(error && typeof error==='object' && 'code' in error && error.code==='MFA_REQUIRED'));
    }
  } finally {
    await closeDatabase();
    process.env.DATABASE_URL=source;
    await getPool().query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await closeDatabase();
    for(const key of Object.keys(process.env))if(!(key in initialEnv))delete process.env[key];
    Object.assign(process.env,initialEnv);
    // Only this isolated test's generated secrets and captured messages are removed.
    assert.equal(dirname(resolve(directory)),resolve(root,'.cache'));
    assert(basename(directory).startsWith('auth-production-test-'));
    await rm(directory,{recursive:true,force:true});
    for (const id of messageIds) await fetch(`http://127.0.0.1:18025/api/v1/messages`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({IDs:[id]})});
  }
});
