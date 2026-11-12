import type {APIRoute} from 'astro';
import {z} from 'zod';
import {requireEditor} from '../../../../server/auth/permissions';
import {getDashboardCampaignOptions,getDashboardMetrics} from '../../../../server/outreach/analytics';
import {consumeRateLimit} from '../../../../server/auth/rate-limit';
import {assertSameOrigin,HttpError,json,jsonError,readJson} from '../../../../server/http';
import {createCampaign,createProspect,deleteProspect,getCampaignOverview,getOutreachOverview,importProspects,markProspectResponded,queueCampaign,setCampaignPaused,suppressProspect,updateCampaign,updateProspect} from '../../../../server/outreach/service';
import {campaignInputSchema,campaignUpdateSchema,importProspectsSchema,pauseCampaignSchema,prospectInputSchema,prospectUpdateSchema,queueInputSchema} from '../../../../server/outreach/validation';

export const ALL:APIRoute=async({request,params})=>{try{
 const actor=await requireEditor(request);const parts=(params.path||'').split('/').filter(Boolean),[collection,id,action]=parts;
 if(parts.length>3)throw new HttpError(404,'NOT_FOUND','Action introuvable.');
 if(request.method==='GET'&&collection==='overview'&&parts.length===1)return json(await getOutreachOverview(actor));
 if(request.method==='GET'&&['analytics','analytics-campaigns'].includes(collection)&&parts.length===1){
  const search=new URL(request.url).searchParams;
  const keys=collection==='analytics'?['days','campaignId']:['q','offset','limit'];
  if(keys.some(key=>search.getAll(key).length>1))throw new HttpError(422,'QUERY','Chaque filtre doit être indiqué une seule fois.');
  if(!await consumeRateLimit('outreach:analytics:'+actor.id,60,60))throw new HttpError(429,'RATE_LIMIT','Trop d’actualisations rapprochées. Patientez une minute.');
  if(collection==='analytics-campaigns')return json(await getDashboardCampaignOptions(actor,{q:search.get('q')??undefined,offset:search.get('offset')??undefined,limit:search.get('limit')??undefined}));
  return json(await getDashboardMetrics(actor,search.get('days')??30,search.get('campaignId')??undefined));
 }
 if(request.method==='GET'&&collection==='campaigns'&&id&&action==='overview')return json(await getCampaignOverview(id,actor));
 assertSameOrigin(request);
 if(!await consumeRateLimit('outreach:admin:'+actor.id,120,60))throw new HttpError(429,'RATE_LIMIT','Trop de demandes rapprochées. Patientez une minute.');
 if(request.method==='POST'&&collection==='contacts'&&id==='import'&&!action)return json(await importProspects(await readJson(request,importProspectsSchema,500000),actor));
 if(id&&!z.uuid().safeParse(id).success)throw new HttpError(404,'NOT_FOUND','Élément introuvable.');
 if(collection==='contacts'){
  if(request.method==='POST'&&!id)return json(await createProspect(await readJson(request,prospectInputSchema,8000),actor),201);
  if(id&&request.method==='PATCH'&&!action)return json(await updateProspect(id,await readJson(request,prospectUpdateSchema,8000),actor));
  if(id&&request.method==='DELETE'&&!action)return json(await deleteProspect(id,actor));
  if(id&&request.method==='POST'&&action==='suppress')return json(await suppressProspect(id,actor));
  if(id&&request.method==='POST'&&action==='responded')return json(await markProspectResponded(id,actor));
 }
 if(collection==='campaigns'){
  if(request.method==='POST'&&!id)return json(await createCampaign(await readJson(request,campaignInputSchema,30000),actor),201);
  if(id&&request.method==='PATCH'&&!action)return json(await updateCampaign(id,await readJson(request,campaignUpdateSchema,30000),actor));
  if(id&&request.method==='POST'&&action==='send')return json(await queueCampaign(id,await readJson(request,queueInputSchema,250000),actor));
  if(id&&request.method==='POST'&&action==='pause')return json(await setCampaignPaused(id,await readJson(request,pauseCampaignSchema,1000),actor));
 }
 throw new HttpError(405,'METHOD_NOT_ALLOWED','Cette opération n’est pas disponible.');
}catch(error){return jsonError(error);}};
