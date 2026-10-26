import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadEnvFile} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {getDb,closeDatabase} from '../apps/web/src/server/db';
import {clientAddress} from '../apps/web/src/server/client-address';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(resolve(root,'apps/web/package.json'));
const {Pool}=require('pg');
const {migrate}=await import(pathToFileURL(require.resolve('drizzle-orm/node-postgres/migrator')).href);
try{loadEnvFile(resolve(root,'apps/web/.env'));}catch{/* CI config */}

test('only explicitly trusted Railway X-Real-IP replaces the adapter address',()=>{
 const previous=process.env.TRUST_RAILWAY_PROXY;
 const request=new Request('https://example.test',{headers:{'x-real-ip':'198.51.100.8','x-forwarded-for':'1.1.1.1'}});
 try{delete process.env.TRUST_RAILWAY_PROXY;assert.equal(clientAddress(request,'127.0.0.1'),'127.0.0.1');process.env.TRUST_RAILWAY_PROXY='true';assert.equal(clientAddress(request,'127.0.0.1'),'198.51.100.8');assert.equal(clientAddress(new Request('https://example.test',{headers:{'x-real-ip':'spoof, 198.51.100.8'}}),'127.0.0.1'),'127.0.0.1');}finally{if(previous===undefined)delete process.env.TRUST_RAILWAY_PROXY;else process.env.TRUST_RAILWAY_PROXY=previous;}
});
test('contact has shared SQL idempotency and atomic multi-process limits',{skip:process.env.RUN_CONTACT_INTEGRATION!=='1'},async t=>{
 const source=new URL(process.env.DATABASE_URL!);assert(['127.0.0.1','localhost','postgres'].includes(source.hostname));
 const name=`calas_contact_test_${randomUUID().replaceAll('-','')}`;
 const control=new Pool({connectionString:source.href,max:1});await control.query(`CREATE DATABASE "${name}"`);
 const isolated=new URL(source);isolated.pathname=`/${name}`;process.env.DATABASE_URL=isolated.href;
 const work=(token:string,addressHash='duplicate',maximum=5,payloadHash='same',singleConnection=false)=>new Promise<{status:number;ok:boolean}>((resolveResult,reject)=>{
  const child=spawn(process.execPath,[require.resolve('tsx/cli'),resolve(root,'tests/fixtures/contact-worker.ts'),JSON.stringify({token,addressHash,maximum,payloadHash,singleConnection})],{cwd:root,env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.resume();child.once('error',reject);child.once('exit',code=>{if(code)reject(new Error('Contact integration worker failed'));else try{resolveResult(JSON.parse(output));}catch{reject(new Error('Invalid worker result'));}});
 });
 try{
  await migrate(getDb(),{migrationsFolder:resolve(root,'drizzle')});
  await getDb().execute('CREATE TABLE test_deliveries (id bigserial PRIMARY KEY)');
  await t.test('four processes submit the same token only once',async()=>{const outcomes=await Promise.all(Array.from({length:4},()=>work('shared-token')));assert(outcomes.every(r=>r.ok));const count=await getDb().execute('SELECT count(*)::integer AS count FROM test_deliveries');assert.equal(count.rows[0]!.count,1);});
  await t.test('changed payload is refused, no content retained',async()=>{assert.equal((await work('shared-token','duplicate',5,'altered')).status,409);const receipts=await getDb().execute('SELECT * FROM contact_receipts');assert.equal(receipts.rows.length,1);assert(!JSON.stringify(receipts.rows).includes('shared-token'));});
  await t.test('eight competing processes share a three-request limit',async()=>{const outcomes=await Promise.all(Array.from({length:8},(_,i)=>work(`rate-${i}`,'rate-only',3)));assert.equal(outcomes.filter(r=>r.ok).length,3);assert.equal(outcomes.filter(r=>r.status===429).length,5);});
  await t.test('a single-connection pool can deliver without waiting on itself',async()=>{assert.equal((await work('single-pool','single-pool',3,'same',true)).status,200);});
 }finally{await closeDatabase();process.env.DATABASE_URL=source.href;await control.query(`DROP DATABASE "${name}" WITH (FORCE)`);await control.end();}
});
