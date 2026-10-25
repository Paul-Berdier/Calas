import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { closeDatabase } from '../apps/web/src/server/db';
import { createBackup, defaultBackupFilename, describeBackup, restoreBackup } from '../apps/web/src/server/content/backup';

try { loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url))); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const [action, path, confirmation, ...extra] = process.argv.slice(2);
try {
  if (extra.length || !['export', 'import'].includes(action || '')) throw new Error('Usage : content:export [backups/archive.calas-backup] ou content:import backups/archive.calas-backup --confirm-empty.');
  if (action === 'export') {
    if (confirmation) throw new Error('L’export n’accepte pas cette option.');
    const target = path || defaultBackupFilename();
    const manifest = await createBackup(target);
    console.log(`Sauvegarde chiffrée créée : ${target}`);
    console.log(JSON.stringify(describeBackup(manifest)));
  } else {
    if (!path || confirmation !== '--confirm-empty') throw new Error('La restauration exige une destination isolée vide et --confirm-empty.');
    const manifest = await restoreBackup(path);
    console.log('Base PostgreSQL, historique, accès et médias restaurés dans la destination isolée.');
    console.log(JSON.stringify(describeBackup(manifest)));
  }
} catch (error) {
  // Database/SDK errors may contain queries or request information: never print their raw objects.
  console.error(error instanceof Error && error.constructor === Error ? error.message : 'La sauvegarde ou restauration a échoué. Vérifiez la procédure et les accès ; aucun secret n’est journalisé.');
  process.exitCode = 1;
} finally { await closeDatabase(); }
