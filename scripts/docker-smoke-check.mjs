import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';

// Packaging check only: no credentials, database, bucket, email or publication.
const image=process.env.DOCKER_TEST_IMAGE||'calas-cms:local-check';
const port=Number(process.env.DOCKER_TEST_PORT||14321);
assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535,'Invalid local test port');
const name=`calas-runtime-smoke-${Date.now()}`;
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',timeout:90_000}).trim();
const report={image,checks:[],stopped:false};
let started=false;
try{
  docker('run','--detach','--rm','--name',name,'--read-only','--tmpfs','/tmp',
    '--publish',`127.0.0.1:${port}:4321`,
    '--env','CONTENT_MODE=demo','--env','SITE_ENV=development',
    '--env','SITE_URL=http://localhost:4321','--env','BETTER_AUTH_URL=http://localhost:4321',image);
  started=true;
  let alive=false;
  for(let attempt=0;attempt<45;attempt++){
    try{const response=await fetch(`http://127.0.0.1:${port}/api/health/`,{signal:AbortSignal.timeout(1500)});if(response.status===200){alive=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert.ok(alive,'Container did not become alive');
  report.checks.push({name:'Linux HTTP liveness',status:200});
  const readiness=await fetch(`http://127.0.0.1:${port}/api/ready/`);
  assert.equal(readiness.status,503,'Missing private configuration must not report ready');
  assert.match(readiness.headers.get('cache-control')||'',/no-store/);
  report.checks.push({name:'Unconfigured readiness fails closed',status:503});
  const home=await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(home.status,200);
  assert.match(await home.text(),/Calas Conseil/);
  assert.match(home.headers.get('x-robots-tag')||'',/noindex/);
  report.checks.push({name:'Explicit demo renders without private services',status:200});
  const runtime=JSON.parse(docker('exec',name,'node','--input-type=module','-e',
    "import fs from 'node:fs';import sharp from 'sharp';const result=await sharp({create:{width:4,height:3,channels:3,background:'#ffffff'}}).webp().toBuffer({resolveWithObject:true});console.log(JSON.stringify({uid:process.getuid(),node:process.version,webp:result.info.format,width:result.info.width,height:result.info.height,envPresent:['/app/.env','/app/apps/web/.env'].some(p=>fs.existsSync(p)),sourcePresent:fs.existsSync('/app/apps/web/src')}));"));
  assert.notEqual(runtime.uid,0);
  assert.equal(runtime.node,'v24.19.0');
  assert.equal(runtime.webp,'webp');assert.equal(runtime.width,4);assert.equal(runtime.height,3);
  assert.equal(runtime.envPresent,false);assert.equal(runtime.sourcePresent,false);
  report.checks.push({name:'Non-root Node and native Sharp; no source or environment file',...runtime});
  const logs=docker('logs',name);
  assert.ok(!logs.includes('Failed to load the configured logger'),'Runtime fell back to the unfiltered Astro logger');
  const events=logs.split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
  assert.ok(events.some(event=>event.level==='info'&&typeof event.message==='string'&&/listening/i.test(event.message)),
    'Astro startup did not use the configured JSON logger');
  report.checks.push({name:'Official Astro runtime logger loaded',jsonStartup:true});
  report.imageId=docker('inspect','--format','{{.Image}}',name);
  report.status='passed';
}catch(error){report.status='failed';report.error=error instanceof Error?error.message:String(error);process.exitCode=1;}
finally{
  if(started){try{docker('stop','--time','10',name);report.stopped=true;}catch{report.cleanupError='Could not stop the smoke container';process.exitCode=1;}}
  await mkdir('artifacts/custom-cms',{recursive:true});
  await writeFile('artifacts/custom-cms/docker-smoke-report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
