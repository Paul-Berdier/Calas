import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadEnvFile} from 'node:process';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createApplicationRole} from '../scripts/database-app-role.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const require = createRequire(new URL('../apps/web/package.json',import.meta.url));
const {Client} = require('pg');
try { loadEnvFile(new URL('../apps/web/.env',import.meta.url)); } catch { /* CI supplies its environment. */ }
const source = process.env.DATABASE_URL;

test('operator requires an explicit test environment before opening any connection', async()=>{
  await assert.rejects(createApplicationRole({connectionString:'postgres://unreachable.invalid/db',environment:'production',expectedDatabase:'db',role:'calas_app',password:'x'.repeat(32)}),/recette/);
});

test('application role can run the CMS seed but cannot modify its schema or migration history', {skip:!source,timeout:60_000}, async()=>{
  assert(['localhost','127.0.0.1','postgres'].includes(new URL(source).hostname),'Only local isolated integration databases are permitted.');
  assert.notEqual(process.env.SITE_ENV,'production','Production must not be used for the role integration test.');
  const suffix = randomBytes(12).toString('hex');
  const database = `calas_role_test_${suffix}`;
  const role = `calas_app_test_${suffix}`;
  assert.match(database,/^calas_role_test_[a-f0-9]{24}$/);
  assert.match(role,/^calas_app_test_[a-f0-9]{24}$/);
  const owner = new Client({connectionString:source});
  await owner.connect();
  const url = new URL(source);
  url.pathname = `/${database}`;
  const password = randomBytes(32).toString('hex');
  let application;
  let isolated;
  try {
    await owner.query(`CREATE DATABASE "${database}"`);
    isolated = new Client({connectionString:url.href});
    await isolated.connect();
    const command = (script,flags,connectionString)=>spawnSync(process.execPath,[require.resolve('tsx/cli'),fileURLToPath(new URL(`../scripts/${script}`,import.meta.url)),...flags],{cwd:root,env:{...process.env,DATABASE_URL:connectionString,SITE_ENV:'test'},encoding:'utf8',windowsHide:true});
    assert.equal(command('database-migrate.ts',['--apply'],url.href).status,0,'isolated migration');
    const configuration = {connectionString:url.href,environment:'test',expectedDatabase:database,role,password};
    await assert.rejects(createApplicationRole({...configuration,expectedDatabase:'another_database'}),/Destination/);
    await createApplicationRole(configuration);
    await assert.rejects(createApplicationRole({...configuration,password:'different-secret'.repeat(4)}),/existe/);
    const appUrl = new URL(url);
    appUrl.username = role;
    appUrl.password = password;
    application = new Client({connectionString:appUrl.href});
    await application.connect();
    assert.equal(command('content-seed-custom.ts',['--apply','--publish-initial'],appUrl.href).status,0,'seed with restricted role');
    assert.equal((await application.query('SELECT COUNT(*)::int AS count FROM content_documents WHERE published_revision_id IS NOT NULL')).rows[0].count,17);
    const flags = (await application.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.ok(Object.values(flags).every(value=>value===false));
    for (const sql of ['CREATE TABLE public.forbidden(id int)','ALTER TABLE content_documents ADD COLUMN forbidden int','TRUNCATE content_documents','SELECT * FROM drizzle.__drizzle_migrations']) {
      await assert.rejects(application.query(sql),error=>error.code==='42501');
    }
    // Future migrations performed by the same owner retain data access without DDL privileges.
    await isolated.query('CREATE TABLE public.operator_test_future (id integer GENERATED ALWAYS AS IDENTITY, value text)');
    await application.query("INSERT INTO public.operator_test_future(value) VALUES ('first')");
    await application.query("UPDATE public.operator_test_future SET value='second'");
    assert.equal((await application.query('SELECT value FROM public.operator_test_future')).rows[0].value,'second');
    await application.query('DELETE FROM public.operator_test_future');
  } finally {
    await application?.end();
    await isolated?.end();
    await owner.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await owner.query(`DROP ROLE IF EXISTS "${role}"`);
    await owner.end();
  }
});
