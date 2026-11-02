import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { closeDatabase } from '../apps/web/src/server/db';
import { migrateDatabase } from '../apps/web/src/server/db/migrate';

try { loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url))); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
try {
  if (!process.argv.includes('--apply') || process.argv.slice(2).some(argument => !['--apply', '--production-approved'].includes(argument))) throw new Error('Exécuter db:migrate --apply après sauvegarde ; --production-approved est nécessaire en production.');
  if (process.env.SITE_ENV === 'production' && !process.argv.includes('--production-approved')) throw new Error('Migration de production refusée sans validation explicite et sauvegarde préalable.');
  await migrateDatabase(fileURLToPath(new URL('../drizzle', import.meta.url)));
  console.log('Migrations PostgreSQL appliquées. Aucun contenu n’a été initialisé ou publié.');
} catch {
  console.error('La migration a échoué ou ses conditions ne sont pas réunies. Vérifiez les paramètres et la procédure ; aucun secret n’est journalisé.');
  process.exitCode = 1;
} finally { await closeDatabase(); }
