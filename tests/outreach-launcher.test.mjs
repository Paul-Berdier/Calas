import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

async function fixture(entry,runner){
 const folder=await mkdtemp(join(tmpdir(),'calas-outreach-launcher-'));
 await mkdir(join(folder,'server'));
 await copyFile(fileURLToPath(new URL('../scripts/start-web.mjs',import.meta.url)),join(folder,'start.mjs'));
 await writeFile(join(folder,'server','entry.mjs'),entry);await writeFile(join(folder,'outreach-runner.mjs'),runner);
 const child=spawn(process.execPath,[join(folder,'start.mjs')],{cwd:folder,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
 const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));});
 const waitFor=async pattern=>{for(let attempt=0;attempt<100;attempt++){const match=output.match(pattern);if(match)return match;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Local launcher fixture did not become ready');};
 return {child,exited,waitFor,output:()=>output,async close(){if(child.exitCode===null){child.kill();await exited;}assert(folder.startsWith(join(tmpdir(),'calas-outreach-launcher-')));await rm(folder,{recursive:true,force:true});}};
}

test('web launcher drains HTTP and the integrated runner on shutdown',{timeout:10000},async()=>{
 const app=await fixture(`import http from 'node:http';
export function startServer(){
 if(process.env.ASTRO_NODE_AUTOSTART!=='disabled')throw new Error('Autostart must be controlled');
 const server=http.createServer((req,res)=>{
  if(req.url==='/hold'){console.log('HOLD_STARTED');setTimeout(()=>res.end('complete'),150);}
  else{res.end('closing');setImmediate(()=>process.emit('SIGTERM'));}
 });
 const done=new Promise((resolve,reject)=>{server.on('close',resolve);server.on('error',reject);});
 server.listen(0,'127.0.0.1',()=>console.log('PORT:'+server.address().port));return {server:{server},done};
}`,`export function startOutreachRunner(){console.log('RUNNER_STARTED');return {stop:async()=>{await new Promise(resolve=>setTimeout(resolve,50));console.log('RUNNER_CLOSED');}};}`);
 try{
  const match=await app.waitFor(/PORT:(\d+)/),base='http://127.0.0.1:'+match[1];await app.waitFor(/RUNNER_STARTED/);
  const pending=fetch(base+'/hold');await app.waitFor(/HOLD_STARTED/);
  assert.equal(await (await fetch(base+'/shutdown')).text(),'closing');assert.equal(await (await pending).text(),'complete');
  assert.equal(await app.exited,0);assert.equal((app.output().match(/RUNNER_CLOSED/g)||[]).length,1);
 }finally{await app.close();}
});

test('web launcher does not expose a startup exception',{timeout:10000},async()=>{
 const app=await fixture(`throw new Error('smtp-password-do-not-print');`,`export function startOutreachRunner(){throw new Error('unused');}`);
 try{assert.equal(await app.exited,1);assert.match(app.output(),/serveur web n’a pas pu démarrer/);assert(!app.output().includes('smtp-password-do-not-print'));}finally{await app.close();}
});
