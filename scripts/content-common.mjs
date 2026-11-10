import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webRequire = createRequire(resolve(root, 'apps/web/package.json'));
export function runContentCommand(script, arguments_ = []) {
  if (!['content-seed-custom.ts', 'content-backup.ts'].includes(script)) throw new Error('Commande de contenu inconnue.');
  const result = spawnSync(process.execPath, [webRequire.resolve('tsx/cli'), resolve(root, 'scripts', script), ...arguments_], { cwd: root, stdio: 'inherit', shell: false, windowsHide: true });
  if (result.error) throw new Error('Le programme de contenu ne peut pas démarrer.');
  process.exitCode = result.status ?? 1;
}
