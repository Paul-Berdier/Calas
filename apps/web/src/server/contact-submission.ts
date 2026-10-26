import {createHmac} from 'node:crypto';
import {getPool} from './db';
import {consumeRateLimit} from './auth/rate-limit';
import type {ContactResult} from '../lib/contact';

export async function sharedContactSubmission(input:{token:string;payloadHash:string;addressHash:string;secret:string;maximum:number;deliver:()=>Promise<ContactResult>}):Promise<ContactResult>{
  const tokenHash=createHmac('sha256',input.secret).update(input.token).digest('hex');
  const client=await getPool().connect();
  try{
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`contact:${tokenHash}`]);
    await client.query('DELETE FROM contact_receipts WHERE expires_at < now()');
    const existing=await client.query<{payload_hash:string;result:ContactResult}>('SELECT payload_hash,result FROM contact_receipts WHERE token_hash=$1',[tokenHash]);
    let result:ContactResult;
    if(existing.rows[0])result=existing.rows[0].payload_hash===input.payloadHash?existing.rows[0].result:{ok:false,status:409,message:'Ce formulaire a déjà été utilisé. Rechargez la page pour une nouvelle demande.'};
    else if(!await consumeRateLimit(`contact:${input.addressHash}`,input.maximum,900,client))result={ok:false,status:429,message:'Trop de tentatives rapprochées. Patientez 15 minutes ou contactez-nous directement.'};
    else{
      result=await input.deliver();
      if(result.ok)await client.query("INSERT INTO contact_receipts (token_hash,payload_hash,result,expires_at) VALUES ($1,$2,$3,now()+interval '1 hour')",[tokenHash,input.payloadHash,JSON.stringify(result)]);
    }
    await client.query('COMMIT');return result;
  }catch{
    await client.query('ROLLBACK').catch(()=>{});
    return {ok:false,status:503,message:'L’envoi est momentanément indisponible. Votre saisie est conservée ; vous pouvez réessayer ou nous joindre directement.'};
  }finally{client.release();}
}
