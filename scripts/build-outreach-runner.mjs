import {build} from 'esbuild';
import {copyFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'apps/web/dist');
await mkdir(output,{recursive:true});
await build({
 absWorkingDir:root,entryPoints:[resolve(root,'apps/web/src/server/outreach/runner.ts')],
 bundle:true,platform:'node',target:'node24',format:'esm',external:['pg-native'],
 banner:{js:'import {createRequire} from "node:module"; const require = createRequire(import.meta.url);'},
 // This bundle owns a different db singleton from SSR; do not mutate process-wide web pool settings.
 define:{'process.env.DATABASE_POOL_MAX':'"2"'},outfile:resolve(output,'outreach-runner.mjs'),
});
await copyFile(resolve(root,'scripts/start-web.mjs'),resolve(output,'start.mjs'));
console.log('Lanceur web et traitement intégré des campagnes compilés. Aucune connexion ni migration exécutée.');
