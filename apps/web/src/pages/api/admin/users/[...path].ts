import type {APIRoute} from 'astro';
import {z} from 'zod';
import {requireAdministrator} from '../../../../server/auth/permissions';
import {listUsers,inviteUser,updateUser} from '../../../../server/auth/users';
import {consumeRateLimit} from '../../../../server/auth/rate-limit';
import {assertSameOrigin,HttpError,json,jsonError,readJson} from '../../../../server/http';
const invitation=z.object({name:z.string().trim().min(2).max(100),email:z.email().max(254),role:z.enum(['administrator','editor'])}).strict();
export const ALL:APIRoute=async({request,params})=>{
  try{
    const actor=await requireAdministrator(request);const path=(params.path||'').replace(/\/$/,'');
    if(request.method==='GET'&&!path)return json({users:await listUsers()});
    if(request.method!=='POST')throw new HttpError(405,'METHOD','Méthode non autorisée.');
    assertSameOrigin(request);
    if(!await consumeRateLimit(`users:${actor.id}`,15,60))throw new HttpError(429,'RATE_LIMIT','Patientez une minute avant de réessayer.');
    if(path==='invite')return json(await inviteUser(actor,await readJson(request,invitation,4096)));
    const [id,action,...rest]=path.split('/');
    if(rest.length||!id||!['disable','enable','revoke','role'].includes(action||''))throw new HttpError(404,'NOT_FOUND','Opération introuvable.');
    const input=await readJson(request,z.object({role:z.enum(['administrator','editor']).optional()}).strict(),4096);
    return json(await updateUser(actor,id,action as 'disable'|'enable'|'revoke'|'role',input.role));
  }catch(error){return jsonError(error);}
};
