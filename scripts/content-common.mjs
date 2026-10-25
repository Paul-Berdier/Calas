import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const path of [resolve(root, '.env'), resolve(root, 'apps/web/.env')]) {
  if (existsSync(path)) process.loadEnvFile(path);
}
const webRequire = createRequire(resolve(root, 'apps/web/package.json'));
const studioRequire = createRequire(resolve(root, 'apps/studio/package.json'));
export const { createClient } = webRequire('@sanity/client');
export function config({ write = false } = {}) {
  const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.PUBLIC_SANITY_DATASET;
  const token = write ? process.env.SANITY_WRITE_TOKEN : process.env.SANITY_EXPORT_TOKEN || process.env.SANITY_API_READ_TOKEN;
  if (!projectId || !dataset || !token) throw new Error('Renseignez le projet, le dataset et le jeton serveur approprié dans l’environnement.');
  if (write && (!/^(staging|development|test)(-[a-z0-9-]+)?$/.test(dataset) || process.env.CALAS_ALLOW_CONTENT_WRITE !== 'yes')) {
    throw new Error('Écriture refusée : dataset de test explicite et CALAS_ALLOW_CONTENT_WRITE=yes requis. Aucun import de démonstration en production.');
  }
  return { projectId, dataset, token, apiVersion: '2026-10-25', useCdn: false, perspective: 'raw' };
}
export function runSanity(args, cfg) {
  const packagePath = studioRequire.resolve('sanity/package.json');
  const cli = resolve(dirname(packagePath), 'bin/sanity');
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: resolve(root, 'apps/studio'), stdio: 'inherit', shell: false,
    env: { ...process.env, SANITY_STUDIO_PROJECT_ID: cfg.projectId, SANITY_STUDIO_DATASET: cfg.dataset, SANITY_AUTH_TOKEN: cfg.token, SANITY_IMPORT_TOKEN: cfg.token },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`La commande Sanity a échoué (code ${result.status}).`);
}
