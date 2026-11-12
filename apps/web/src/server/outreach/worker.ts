import {getPool} from '../db';
import {consumeRateLimit} from '../auth/rate-limit';
import {deliverOutreachMail,type MailOutcome,type OutreachMail} from './mail';
import {outreachTransport,lockProspect,purgeExpiredProspects,getPublicTargets} from './service';
import {unseal} from './tokens';

export interface WorkerResult {accepted:number;simulated:number;failed:number;uncertain:number;suppressed:number;retried:number;purged:number;busy:boolean;rateLimited:boolean}
/** The callback is injectable for local tests only; the production runner always uses authenticated SMTP. */
export async function processOutreachQueue(options:{limit?:number;signal?:AbortSignal;deliver?:(mail:OutreachMail)=>Promise<MailOutcome>}={}):Promise<WorkerResult>{
 const result:WorkerResult={accepted:0,simulated:0,failed:0,uncertain:0,suppressed:0,retried:0,purged:0,busy:false,rateLimited:false};
 if(options.signal?.aborted)return result;
 const limit=Math.min(100,Math.max(1,options.limit||10));
 const hourly=Math.min(10000,Math.max(1,Number(process.env.OUTREACH_MAX_PER_HOUR)||20));
 const mode=outreachTransport();result.purged=await purgeExpiredProspects();
 const client=await getPool().connect();
 let locked=false;
 try{
  locked=(await client.query<{locked:boolean}>('SELECT pg_try_advisory_lock(64236011) AS locked')).rows[0]!.locked;
  if(!locked){result.busy=true;return result;}
  // A crash at any point after claiming might have followed SMTP acceptance: never auto-replay it.
  result.uncertain+=(await client.query("UPDATE outreach_deliveries SET status='uncertain',finished_at=now() WHERE status='sending' AND started_at<now()-interval '15 minutes'")).rowCount||0;
  for(let index=0;index<limit;index++){
   if(options.signal?.aborted)break;
   const next=(await client.query<{id:string;email_hash:string;transport:string;campaign_id:string}>("SELECT d.id,d.email_hash,d.transport,d.campaign_id FROM outreach_deliveries d JOIN outreach_campaigns c ON c.id=d.campaign_id WHERE d.status='queued' AND c.status='active' AND d.next_attempt_at<=now() AND (d.scheduled_at IS NULL OR d.scheduled_at<=now()) AND (d.transport='simulation' OR d.transport=$1) ORDER BY d.created_at,d.id LIMIT 1",[mode])).rows[0];
   if(!next)break;
   if(next.transport!=='simulation'&&!await consumeRateLimit('outreach:smtp:hour',hourly,3600,client)){result.rateLimited=true;break;}
   // Commit the claim before talking to SMTP. A later database outage cannot make it queued again.
   await client.query('BEGIN');
   const active=(await client.query("SELECT id FROM outreach_campaigns WHERE id=$1 AND status='active' FOR SHARE",[next.campaign_id])).rowCount;
   if(!active){await client.query('COMMIT');continue;}
   await lockProspect(client,next.email_hash);
   const row=(await client.query(`SELECT d.*,c.link_encrypted,c.target_path,p.source,p.status AS contact_status,p.retention_until,EXISTS(SELECT 1 FROM outreach_suppressions s WHERE s.email_hash=d.email_hash) AS excluded FROM outreach_deliveries d JOIN outreach_campaigns c ON c.id=d.campaign_id JOIN outreach_prospects p ON p.id=d.contact_id WHERE d.id=$1 AND d.status='queued' FOR UPDATE OF d`,[next.id])).rows[0];
   if(!row){await client.query('COMMIT');continue;}
   if(row.excluded||row.contact_status!=='active'||new Date(row.retention_until).getTime()<=Date.now()){
    await client.query("UPDATE outreach_deliveries SET status='suppressed',finished_at=now() WHERE id=$1",[row.id]);await client.query('COMMIT');result.suppressed++;continue;
   }
   if(!(await getPublicTargets(client)).some(target=>target.path===row.target_path)){
    await client.query("UPDATE outreach_deliveries SET status='failed',finished_at=now() WHERE id=$1",[row.id]);await client.query('COMMIT');result.failed++;continue;
   }
   await client.query("UPDATE outreach_deliveries SET status='sending',attempts=attempts+1,started_at=now() WHERE id=$1",[row.id]);
   // Keep the same per-address exclusion lock across the committed claim and SMTP operation.
   await client.query('SELECT pg_advisory_lock(hashtextextended($1,0))',['outreach:'+next.email_hash]);
   await client.query('COMMIT');
   try{
    let outcome:MailOutcome;
    try{outcome=await (options.deliver||deliverOutreachMail)({id:row.id,email:row.email,subject:row.subject,body:row.body,source:row.source,transport:row.transport,campaignLink:'/r/'+unseal(row.link_encrypted),unsubscribeLink:'/r/'+unseal(row.unsubscribe_encrypted)});}catch{outcome='uncertain';}
    if(outcome==='retry'&&row.attempts<2){await client.query("UPDATE outreach_deliveries SET status='queued',next_attempt_at=now()+interval '15 minutes',finished_at=now() WHERE id=$1 AND status='sending'",[row.id]);result.retried++;}
    else{const final=outcome==='retry'?'failed':outcome;await client.query("UPDATE outreach_deliveries SET status=$2,finished_at=now() WHERE id=$1 AND status='sending'",[row.id,final]);result[final]++;}
   }finally{await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',['outreach:'+next.email_hash]);}
  }
  return result;
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
 finally{let discard=false;if(locked)try{await client.query('SELECT pg_advisory_unlock_all()');}catch{discard=true;}client.release(discard);}
}
