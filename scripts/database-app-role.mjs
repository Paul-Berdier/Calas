import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const {Client} = require('pg');
const identifier = value => `"${value.replaceAll('"', '""')}"`;

/** An operator-only action. It never rotates, replaces or elevates an existing role. */
export async function createApplicationRole(configuration) {
  const {connectionString, environment, expectedDatabase, role, password} = configuration;
  if (!['development', 'test', 'staging'].includes(environment)) throw new Error('Environnement de recette explicite requis.');
  if (!connectionString || !expectedDatabase || !/^[a-z][a-z0-9_]{2,48}$/.test(role || '') || !password || password.length < 32) {
    throw new Error('Base attendue, rôle valide et secret privé de 32 caractères minimum requis.');
  }
  const client = new Client({connectionString, application_name:'calas-role-operator', connectionTimeoutMillis:5_000, statement_timeout:15_000});
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(64236002)');
    const {rows:[target]} = await client.query('SELECT current_database() AS database, current_user AS owner, to_regclass(\'public.content_documents\') AS content, to_regclass(\'public.auth_user\') AS users');
    if (target.database !== expectedDatabase || target.owner === role || !target.content || !target.users) throw new Error('Destination non confirmée ou migrations manquantes.');
    if ((await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) throw new Error('Le rôle existe déjà ; aucune modification de ses droits ou de son secret.');
    // PostgreSQL quotes the identifier and literal; SQL/driver errors never reach the CLI output.
    const {rows:[creation]} = await client.query("SELECT format('CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', $1::text, $2::text) AS statement", [role,password]);
    await client.query(creation.statement);
    const quotedRole = identifier(role);
    await client.query(`GRANT CONNECT ON DATABASE ${identifier(target.database)} TO ${quotedRole}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${quotedRole}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quotedRole}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quotedRole}`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quotedRole}`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${quotedRole}`);
    const {rows:[privileges]} = await client.query("SELECT has_database_privilege($1,current_database(),'CREATE') AS database_create, has_schema_privilege($1,'public','CREATE') AS schema_create", [role]);
    if (privileges.database_create || privileges.schema_create) throw new Error('Des droits publics hérités permettent la création de schéma ou de tables ; corriger les ACL avant de recommencer.');
    await client.query('COMMIT');
    return {role, database:target.database};
  } catch (error) {
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== '--apply') throw new Error('Option explicite --apply requise.');
    await createApplicationRole({connectionString:process.env.DATABASE_URL, environment:process.env.SITE_ENV, expectedDatabase:process.env.APP_DATABASE_EXPECTED, role:process.env.APP_DATABASE_ROLE, password:process.env.APP_DATABASE_PASSWORD});
    console.log('Rôle applicatif limité créé. Aucun secret affiché. Conserver le compte propriétaire pour les migrations explicites.');
  } catch {
    console.error('Création refusée ou service indisponible. Vérifier la destination, les migrations, le rôle et les ACL ; aucun secret affiché.');
    process.exitCode = 1;
  } finally { delete process.env.APP_DATABASE_PASSWORD; }
}
