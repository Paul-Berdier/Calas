import {createHash} from 'node:crypto';
import {getPool} from '../db';

/** Atomic shared fixed windows: no process-local counter or forwarded IP trust. */
export async function consumeRateLimit(key:string,maximum:number,windowSeconds:number):Promise<boolean>{
  const hashed=createHash('sha256').update(key).digest('hex');
  const now=Date.now(),windowMs=windowSeconds*1000;
  await getPool().query('DELETE FROM auth_rate_limit WHERE last_request < $1',[now-86_400_000]);
  const result=await getPool().query<{count:number}>(`INSERT INTO auth_rate_limit (id,key,count,last_request) VALUES ($1,$1,1,$2)
    ON CONFLICT (key) DO UPDATE SET count=CASE WHEN auth_rate_limit.last_request <= $2-$3 THEN 1 ELSE auth_rate_limit.count+1 END,
    last_request=CASE WHEN auth_rate_limit.last_request <= $2-$3 THEN $2 ELSE auth_rate_limit.last_request END RETURNING count`,[hashed,now,windowMs]);
  return result.rows[0]!.count<=maximum;
}
