import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb } from './index';

export async function migrateDatabase(migrationsFolder: string): Promise<void> {
  await migrate(getDb(), { migrationsFolder });
}
