import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const base='http://localhost:4336';
if(await fetch(`${base}/api/health/`,{signal:AbortSignal.timeout(1000)}).then(()=>true,()=>false))throw new Error('Le port4336 est occupé. La recette ne remplace aucun serveur.');
const server=spawn(process.execPath,['--env-file-if-exists=.env','dist/server/entry.mjs'],{cwd:resolve(root,'apps/web'),env:{...process.env,HOST:'127.0.0.1',PORT:'4336',BETTER_AUTH_URL:base,SITE_URL:base,CONTENT_MODE:'database',SITE_ENV:'test'},windowsHide:true,stdio:'ignore'});
const run=(script,args=[])=>new Promise((done,reject)=>{const child=spawn(process.execPath,[resolve(root,'scripts',script),...args],{cwd:root,env:{...process.env,CALAS_TEST_BASE_URL:base,BASE_URL:'http://127.0.0.1:4336'},stdio:'inherit',windowsHide:true});child.once('error',reject);child.once('exit',code=>code===0?done():reject(new Error(`Échec de ${script}`)));});
try{
 let ready=false;
 for(let i=0;i<80;i++){if(server.exitCode!==null)throw new Error('Le serveur de recette a quitté.');ready=await fetch(`${base}/api/ready/`,{signal:AbortSignal.timeout(1000)}).then(r=>r.ok,()=>false);if(ready)break;await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw new Error('Le serveur de recette reste indisponible.');
 if(process.env.CI==='true')await run('performance-check.mjs');
 await run('auth-browser-check.mjs');await run('auth-security-check.mjs');await run('pdf-editorial-e2e.mjs');await run('auth-session-check.mjs');await run('image-crop-check.mjs');if(process.env.CI==='true')await run('admin-ui-check.mjs',['--authenticated']);await run('logo-coil-check.mjs');
 await run('motion-loading-check.mjs');await run('brand-browser.mjs');
}finally{server.kill();}
