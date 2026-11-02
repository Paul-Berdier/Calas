import type {APIRoute} from 'astro';
import {z} from 'zod';
import {acceptInvitation} from '../../../server/auth/users';
import {consumeRateLimit} from '../../../server/auth/rate-limit';
import {assertSameOrigin,HttpError,json,jsonError,readJson} from '../../../server/http';
export const POST:APIRoute=async({request,clientAddress})=>{
  try{
    assertSameOrigin(request);
    if(!await consumeRateLimit(`invitation:${clientAddress}`,8,300))throw new HttpError(429,'RATE_LIMIT','Trop de tentatives. Réessayez dans quelques minutes.');
    const input=await readJson(request,z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/),password:z.string().min(12).max(128)}).strict(),4096);
    return json(await acceptInvitation(input.token,input.password));
  }catch(error){return jsonError(error);}
};
