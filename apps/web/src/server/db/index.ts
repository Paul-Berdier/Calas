import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

let pool: Pool | undefined;
let database: ReturnType<typeof drizzle> | undefined;

/** Open connections only when a request or an explicit maintenance command needs them. */
export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('La connexion PostgreSQL n’est pas configurée.');
  const maximum = Number(process.env.DATABASE_POOL_MAX || 10);
  pool = new Pool({
    connectionString,
    max: Number.isInteger(maximum) && maximum > 0 && maximum <= 30 ? maximum : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    application_name: 'calas-conseil',
  });
  pool.on('error', () => { /* Requests report a generic outage; never log connection strings. */ });
  return pool;
}

export function getDb() {
  database ??= drizzle(getPool());
  return database;
}

export async function closeDatabase(): Promise<void> {
  const previous = pool;
  pool = undefined;
  database = undefined;
  await previous?.end();
}

export type Database = ReturnType<typeof getDb>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DatabaseExecutor = Database | Transaction;
