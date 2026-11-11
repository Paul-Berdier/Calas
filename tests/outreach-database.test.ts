import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadEnvFile} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {getDb,getPool,closeDatabase} from '../apps/web/src/server/db';
import {createCampaign,createProspect,deleteProspect,getCampaignLanding,getCampaignOverview,getOutreachOverview,getUnsubscribe,importProspects,markProspectResponded,queueCampaign,recordCampaignVisit,setCampaignPaused,suppressProspect,unsubscribeInvitation,updateCampaign} from '../apps/web/src/server/outreach/service';
import {processOutreachQueue} from '../apps/web/src/server/outreach/worker';
import {unseal} from '../apps/web/src/server/outreach/tokens';
import type {Actor} from '../apps/web/src/server/auth/permissions';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(resolve(root,'apps/web/package.json'));
const {Pool}=require('pg');
const {migrate}=await import(pathToFileURL(require.resolve('drizzle-orm/node-postgres/migrator')).href);
try{loadEnvFile(resolve(root,'apps/web/.env'));}catch{/* Test runner may provide env. */}

test('outreach queue, privacy, opposition and concurrency in an isolated local database',{skip:process.env.RUN_OUTREACH_INTEGRATION!=='1'},async t=>{
 const source=new URL(process.env.DATABASE_URL!);assert(['127.0.0.1','localhost','postgres'].includes(source.hostname));
 const name=`calas_outreach_test_${randomUUID().replaceAll('-','')}`;
 const control=new Pool({connectionString:source.href,max:1});await control.query(`CREATE DATABASE "${name}"`);
 const isolated=new URL(source);isolated.pathname=`/${name}`;process.env.DATABASE_URL=isolated.href;process.env.OUTREACH_LINK_SECRET='isolated-outreach-test-key-'.repeat(3);process.env.OUTREACH_MAIL_TRANSPORT='simulation';
 const actor:Actor={id:randomUUID(),name:'Recette',email:'editor@example.test',role:'editor'};
 const contact=(email:string)=>({email,name:'Contact de recette',company:'Entreprise de recette',jobTitle:'Direction',source:'Invitation professionnelle de recette',sourceDate:new Date().toISOString().slice(0,10),informationConfirmed:true});
 const campaign=()=>createCampaign({title:'Campagne locale',subject:'Sujet de recette',body:'Texte de présentation professionnelle.',targetPath:'/contact/'},actor);
 try{
  await migrate(getDb(),{migrationsFolder:resolve(root,'drizzle')});
  await getPool().query('INSERT INTO auth_user(id,name,email,email_verified,role) VALUES($1,$2,$3,true,$4)',[actor.id,actor.name,actor.email,actor.role]);
  await t.test('same campaign/contact queues once; concurrent version check refuses stale confirmation',async()=>{
   const p=await createProspect(contact('one@example.test'),actor),c=await campaign();
   const outcomes=await Promise.allSettled([1,2].map(()=>queueCampaign(c.id,{version:0,contactIds:[p.id],confirmation:true},actor)));
   assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
   assert.equal((await getPool().query('SELECT id FROM outreach_deliveries WHERE campaign_id=$1',[c.id])).rowCount,1);
   await assert.rejects(()=>updateCampaign(c.id,{version:1,title:'Changé',subject:'Sujet',body:'Texte suffisamment long',targetPath:'/contact/'},actor));
   const work=await processOutreachQueue();assert.equal(work.simulated,1);assert.equal(work.accepted,0);
   assert.equal((await queueCampaign(c.id,{version:1,contactIds:[p.id],confirmation:true},actor)).queued,0);
  });
  await t.test('individual opposition cancels all future queues and survives erasure/import',async()=>{
   const p=await createProspect(contact('opposition@example.test'),actor),c=await campaign();await queueCampaign(c.id,{version:0,contactIds:[p.id],confirmation:true},actor);
   const d=(await getPool().query('SELECT unsubscribe_encrypted FROM outreach_deliveries WHERE contact_id=$1',[p.id])).rows[0];const token=unseal(d.unsubscribe_encrypted);
   assert.deepEqual(await getUnsubscribe(token),{subscribed:true});await unsubscribeInvitation(token);assert.deepEqual(await getUnsubscribe(token),{subscribed:false});await unsubscribeInvitation(token);
   const work=await processOutreachQueue();assert.equal(work.simulated,0);
   await deleteProspect(p.id,actor);assert.deepEqual(await getUnsubscribe(token),{subscribed:false});assert.equal((await importProspects({contacts:[contact('opposition@example.test')]},actor)).created,1);
   const reimported=(await getPool().query('SELECT id,status FROM outreach_prospects WHERE email=$1',['opposition@example.test'])).rows[0];assert.equal(reimported.status,'suppressed');const next=await campaign();assert.equal((await queueCampaign(next.id,{version:0,contactIds:[reimported.id],confirmation:true},actor)).queued,0);
  });
  await t.test('GET campaign and unsubscribe previews have no analytics side effects; aggregate visits cannot use recipient token',async()=>{
   const c=await campaign();const token=c.linkPath.split('/').at(-1)!;assert.equal((await getCampaignLanding(token))?.targetPath,'/contact/');assert.equal((await getOutreachOverview(actor)).stats.visits,0);await recordCampaignVisit(token,'/contact/',true);await recordCampaignVisit(token,'/reflexions/');
   const snapshot=await getOutreachOverview(actor);assert.equal(snapshot.stats.visits,2);assert.equal(snapshot.stats.arrivals,1);assert(snapshot.visits.every(v=>!Object.hasOwn(v,'contactId')&&!Object.hasOwn(v,'email')));
   await assert.rejects(()=>recordCampaignVisit('u_'+'a'.repeat(43),'/contact/'));await assert.rejects(()=>recordCampaignVisit(token,'/admin/'));
  });
  await t.test('a network failure after SMTP DATA becomes uncertain and is not replayed',async()=>{
   const p=await createProspect(contact('ambiguous@example.test'),actor),c=await campaign();await queueCampaign(c.id,{version:0,contactIds:[p.id],confirmation:true},actor);let sent=0;
   const outcome=await processOutreachQueue({deliver:async()=>{sent++;return 'uncertain';}});assert.equal(outcome.uncertain,1);await processOutreachQueue({deliver:async()=>{sent++;return 'accepted';}});assert.equal(sent,1);
  });
  await t.test('explicit transient SMTP rejection has at most three attempts',async()=>{
   const p=await createProspect(contact('retry@example.test'),actor),c=await campaign();await queueCampaign(c.id,{version:0,contactIds:[p.id],confirmation:true},actor);let attempts=0;
   for(let index=0;index<3;index++){await getPool().query('UPDATE outreach_deliveries SET next_attempt_at=now() WHERE contact_id=$1',[p.id]);await processOutreachQueue({deliver:async()=>{attempts++;return 'retry';}});}
   await processOutreachQueue({deliver:async()=>{attempts++;return 'accepted';}});assert.equal(attempts,3);assert.equal((await getPool().query('SELECT status FROM outreach_deliveries WHERE contact_id=$1',[p.id])).rows[0].status,'failed');
  });
  await t.test('two concurrent workers cannot dispatch the same message',async()=>{
   const p=await createProspect(contact('parallel@example.test'),actor),c=await campaign();await queueCampaign(c.id,{version:0,contactIds:[p.id],confirmation:true},actor);const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();let attempts=0;
   const first=processOutreachQueue({deliver:async()=>{attempts++;entered.resolve();await release.promise;return 'accepted';}});await entered.promise;const second=await processOutreachQueue({deliver:async()=>{attempts++;return 'accepted';}});assert.equal(second.busy,true);release.resolve();assert.equal((await first).accepted,1);assert.equal(attempts,1);
  });
  await t.test('manual reply and operator exclusion stop queued messages',async()=>{
   const a=await createProspect(contact('reply@example.test'),actor),b=await createProspect(contact('excluded@example.test'),actor),c=await campaign();await queueCampaign(c.id,{version:0,contactIds:[a.id,b.id],confirmation:true},actor);await markProspectResponded(a.id,actor);await suppressProspect(b.id,actor);assert.equal((await processOutreachQueue()).simulated,0);
  });
  await t.test('worker crashed sending records become uncertain; never automatically queued',async()=>{
   const p=await createProspect(contact('crashed@example.test'),actor),c=await campaign();await queueCampaign(c.id,{version:0,contactIds:[p.id],confirmation:true},actor);await getPool().query("UPDATE outreach_deliveries SET status='sending',started_at=now()-interval '20 minutes' WHERE contact_id=$1",[p.id]);assert.equal((await processOutreachQueue()).uncertain,1);assert.equal((await processOutreachQueue()).simulated,0);
  });
  await t.test('graceful stop finishes the current message and leaves the next one queued',async()=>{
   const a=await createProspect(contact('shutdown-one@example.test'),actor),b=await createProspect(contact('shutdown-two@example.test'),actor),c=await campaign();await queueCampaign(c.id,{version:0,contactIds:[a.id,b.id],confirmation:true},actor);const controller=new AbortController();let sent=0;const outcome=await processOutreachQueue({signal:controller.signal,deliver:async()=>{sent++;controller.abort();return 'accepted';}});assert.equal(sent,1);assert.equal(outcome.accepted,1);assert.equal((await getCampaignOverview(c.id,actor)).stats.queued,1);assert.equal((await processOutreachQueue()).simulated,1);
  });
  await t.test('pause prevents dispatch, resuming uses fresh version, totals include all campaign members',async()=>{
   const p=await createProspect(contact('pause@example.test'),actor),c=await campaign();await queueCampaign(c.id,{version:0,contactIds:[p.id],confirmation:true},actor);await setCampaignPaused(c.id,{version:1,paused:true},actor);assert.equal((await processOutreachQueue()).simulated,0);await assert.rejects(()=>queueCampaign(c.id,{version:2,contactIds:[p.id],confirmation:true},actor));await setCampaignPaused(c.id,{version:2,paused:false},actor);assert.equal((await processOutreachQueue()).simulated,1);const detail=await getCampaignOverview(c.id,actor);assert.equal(detail.stats.simulated,1);assert.deepEqual(detail.includedContactIds,[p.id]);
  });
  await t.test('expired personal records are purged but their opposition capability remains valid',async()=>{
   const p=await createProspect(contact('retention@example.test'),actor),c=await campaign();await queueCampaign(c.id,{version:0,contactIds:[p.id],confirmation:true},actor);const d=(await getPool().query('SELECT unsubscribe_encrypted FROM outreach_deliveries WHERE contact_id=$1',[p.id])).rows[0];const token=unseal(d.unsubscribe_encrypted);await getPool().query("UPDATE outreach_prospects SET retention_until=now()-interval '1 day' WHERE id=$1",[p.id]);assert.equal((await processOutreachQueue()).purged,1);assert.equal((await getPool().query('SELECT id FROM outreach_prospects WHERE id=$1',[p.id])).rowCount,0);await unsubscribeInvitation(token);assert.deepEqual(await getUnsubscribe(token),{subscribed:false});
  });
  await t.test('a destination unpublished after enqueue is rejected before SMTP',async()=>{
   const page=randomUUID(),revision=randomUUID();
   await getPool().query("INSERT INTO content_documents(id,kind,internal_title) VALUES($1,'page','Page de recette')",[page]);
   await getPool().query("INSERT INTO content_revisions(id,document_id,version,content,action,created_by_name) VALUES($1,$2,1,'{}','created','Recette')",[revision,page]);
   await getPool().query("UPDATE content_documents SET status='published',published_revision_id=$2 WHERE id=$1",[page,revision]);await getPool().query("INSERT INTO pages(id,slug,page_type) VALUES($1,'outreach-test-page','page')",[page]);
   const p=await createProspect(contact('unpublished@example.test'),actor),c=await createCampaign({title:'Page publiée',subject:'Découvrir',body:'Texte suffisamment complet',targetPath:'/outreach-test-page/'},actor);await queueCampaign(c.id,{version:0,contactIds:[p.id],confirmation:true},actor);
   await getPool().query("UPDATE content_documents SET status='draft',published_revision_id=NULL WHERE id=$1",[page]);let sent=0;const work=await processOutreachQueue({deliver:async()=>{sent++;return 'accepted';}});assert.equal(work.failed,1);assert.equal(sent,0);assert.equal(await getCampaignLanding(c.linkPath.split('/').at(-1)!),null);
  });
  await t.test('a thousand-recipient campaign is queued atomically and detail totals are not the recent-deliveries excerpt',async()=>{
   for(let start=0;start<1001;start+=200)await importProspects({contacts:Array.from({length:Math.min(200,1001-start)},(_,offset)=>contact(`bulk-${start+offset}@example.test`))},actor);
   const ids=(await getPool().query<{id:string}>("SELECT id FROM outreach_prospects WHERE email LIKE 'bulk-%@example.test' ORDER BY email")).rows.map(row=>row.id);
   const c=await campaign(),previous=process.env.OUTREACH_MAX_BATCH;process.env.OUTREACH_MAX_BATCH='2000';
   try{assert.equal((await queueCampaign(c.id,{version:0,contactIds:ids,confirmation:true},actor)).queued,1001);await setCampaignPaused(c.id,{version:1,paused:true},actor);const detail=await getCampaignOverview(c.id,actor);assert.equal(detail.stats.total,1001);assert.equal(detail.includedContactIds.length,1001);assert.equal((await getOutreachOverview(actor)).deliveries.length,1000);}finally{if(previous===undefined)delete process.env.OUTREACH_MAX_BATCH;else process.env.OUTREACH_MAX_BATCH=previous;}
  });
 }finally{await closeDatabase();process.env.DATABASE_URL=source.href;await control.query(`DROP DATABASE "${name}" WITH (FORCE)`);await control.end();}
});
