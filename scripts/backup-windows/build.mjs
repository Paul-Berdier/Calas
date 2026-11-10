import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, mkdtemp, readFile, readdir, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Build a self-contained operator bundle. The Windows task executes this installed
// copy with Paul's file permissions, independently of future changes in the checkout.
const source=fileURLToPath(new URL('../../',import.meta.url));
const cache=join(source,'.cache');
await mkdir(cache,{recursive:true});
const output=await mkdtemp(join(cache,'daily-backup-bundle-'));
const entry='apps/web/src/server/content/daily-backup.mjs';
await mkdir(dirname(join(output,entry)),{recursive:true});
await build({
  entryPoints:[join(source,'scripts/daily-backup.ts')],
  outfile:join(output,entry),bundle:true,platform:'node',target:'node24',format:'esm',
  banner:{js:"import { createRequire as createNodeRequire } from 'node:module'; const require = createNodeRequire(import.meta.url);"},
  external:['pg-native'],logLevel:'warning'
});
const files=[entry,'run.ps1','railway-launch.mjs'];
for(const name of files.slice(1))await copyFile(join(source,'scripts/backup-windows',name),join(output,name));
await mkdir(join(output,'drizzle'));
for(const name of (await readdir(join(source,'drizzle'))).filter(n=>n.endsWith('.sql')).sort()){
  const target='drizzle/'+name;
  await copyFile(join(source,target),join(output,target));
  files.push(target);
}
const manifest={};
for(const file of files)manifest[file]=createHash('sha256').update(await readFile(join(output,file))).digest('hex');
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(output);
