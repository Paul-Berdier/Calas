import {getPool} from './db';
import {getMediaStorage} from './media/storage';

export function configurationProblems():string[]{
 const missing:string[]=[];
 for(const key of ['DATABASE_URL','BETTER_AUTH_URL','BETTER_AUTH_SECRET','S3_ENDPOINT','S3_REGION','S3_BUCKET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','CONTACT_SIGNING_SECRET','SITE_URL'])if(!process.env[key])missing.push(key);
 if((process.env.BETTER_AUTH_SECRET?.length??0)<32)missing.push('BETTER_AUTH_SECRET (32 caractères minimum)');
 if((process.env.CONTACT_SIGNING_SECRET?.length??0)<32)missing.push('CONTACT_SIGNING_SECRET (32 caractères minimum)');
 try{const auth=new URL(process.env.BETTER_AUTH_URL!);const site=new URL(process.env.SITE_URL!);if(auth.origin!==site.origin||auth.pathname!=='/'||site.pathname!=='/')missing.push('SITE_URL / BETTER_AUTH_URL (même origine)');if(process.env.SITE_ENV==='production'&&(site.protocol!=='https:'||['localhost','127.0.0.1'].includes(site.hostname)))missing.push('SITE_URL (HTTPS public)');}catch{missing.push('SITE_URL / BETTER_AUTH_URL (URL valide)');}
 if(process.env.SITE_ENV==='production'){
  if(process.env.AUTH_TEST_PASSWORD_ONLY_USER_ID)missing.push('AUTH_TEST_PASSWORD_ONLY_USER_ID interdit en production');
  if(process.env.CONTENT_MODE!=='database')missing.push('CONTENT_MODE=database');
  if(process.env.AUTH_MAIL_TRANSPORT!=='smtp'||process.env.ALLOW_REAL_EMAIL!=='true')missing.push('Transport SMTP authentification autorisé');
  for(const key of ['SMTP_HOST','SMTP_FROM','SMTP_USER','SMTP_PASS'])if(!process.env[key])missing.push(key);
 }
 return [...new Set(missing)];
}
export async function checkServices():Promise<void>{
 let timeout:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([
  Promise.all([getPool().query('SELECT d.draft_revision_id,d.published_revision_id FROM content_documents d CROSS JOIN contact_receipts r LIMIT 0'),getMediaStorage().check()]),
  new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Readiness timeout')),5000);timeout.unref();}),
 ]);}finally{clearTimeout(timeout);}
}
