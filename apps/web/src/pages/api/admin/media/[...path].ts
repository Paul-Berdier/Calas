import type {APIRoute} from 'astro';
import {z} from 'zod';
import {requireEditor,requireAdministrator} from '../../../../server/auth/permissions';
import {assertSameOrigin} from '../../../../server/http';
import {consumeRateLimit} from '../../../../server/auth/rate-limit';
import {listMedia,findMedia,mediaDto,uploadMedia,editMedia,replaceMedia,deleteMedia,cleanupMediaObjects} from '../../../../server/media/service';
import {MediaError} from '../../../../server/media/validation';
import {isMediaPublished} from '../../../../server/content/repository';
import {mediaForm,mediaJson,mediaJsonResponse,mediaErrorResponse} from '../../../../server/media/http';

export const ALL:APIRoute=async({request,params,url})=>{
  try{
    const actor=await requireEditor(request);
    const method=request.method;
    if(!['GET','HEAD'].includes(method))assertSameOrigin(request);
    const path=(params.path??'').replace(/\/$/,'').split('/').filter(Boolean);
    if(!path.length&&method==='GET'){
      const offset=Number(url.searchParams.get('offset')??0);
      if(!Number.isInteger(offset)||offset<0||offset>10000)throw new MediaError(400,'INVALID_OFFSET','Pagination invalide.');
      return mediaJsonResponse(await listMedia(actor,{search:url.searchParams.get('q')??'',offset,imagesOnly:url.searchParams.get('kind')==='image',pdfOnly:url.searchParams.get('kind')==='pdf'}));
    }
    if(!path.length&&method==='POST'){
      if(!await consumeRateLimit(`media-upload:${actor.id}`,20,60))throw new MediaError(429,'UPLOAD_RATE','Trop d’imports rapprochés. Patientez une minute.');
      const {form,file}=await mediaForm(request);
      const idempotencyKey=z.string().uuid().parse(form.get('idempotencyKey'));
      return mediaJsonResponse(await uploadMedia(actor,{bytes:new Uint8Array(await file.arrayBuffer()),filename:file.name,idempotencyKey}),201);
    }
    if(path[0]==='cleanup'&&path.length===1&&method==='POST'){
      await requireAdministrator(request);return mediaJsonResponse(await cleanupMediaObjects());
    }
    const id=z.string().uuid().safeParse(path[0]);
    if(!id.success)throw new MediaError(404,'MEDIA_MISSING','Ce média n’est pas disponible.');
    if(path.length===1&&method==='GET'){
      const row=await findMedia(id.data);if(!row)throw new MediaError(404,'MEDIA_MISSING','Ce média n’est plus disponible.');
      if(actor.role!=='administrator'&&row.createdBy!==actor.id&&!await isMediaPublished(row.id,{download:row.mimeType==='application/pdf'}))throw new MediaError(404,'MEDIA_MISSING','Ce média n’est pas disponible.');
      return mediaJsonResponse(mediaDto(row,actor));
    }
    if(path.length===1&&method==='PATCH')return mediaJsonResponse(await editMedia(actor,id.data,await mediaJson(request)));
    if(path.length===2&&path[1]==='replace'&&method==='POST'){
      if(!await consumeRateLimit(`media-upload:${actor.id}`,20,60))throw new MediaError(429,'UPLOAD_RATE','Trop d’imports rapprochés. Patientez une minute.');
      const {file,form}=await mediaForm(request);
      const expectedUpdatedAt=z.string().datetime().parse(form.get('expectedUpdatedAt'));
      return mediaJsonResponse(await replaceMedia(actor,id.data,{bytes:new Uint8Array(await file.arrayBuffer()),filename:file.name,expectedUpdatedAt,confirmReferences:form.get('confirmReferences')==='true'}));
    }
    if(path.length===1&&method==='DELETE'){
      const body=z.object({expectedUpdatedAt:z.string().datetime()}).strict().parse(await mediaJson(request));
      return mediaJsonResponse(await deleteMedia(actor,id.data,body.expectedUpdatedAt));
    }
    return mediaJsonResponse({error:'Cette opération n’est pas disponible.'},405);
  }catch(error){
    if(error instanceof z.ZodError)return mediaJsonResponse({error:'La requête contient un champ invalide.',code:'VALIDATION'},422);
    return mediaErrorResponse(error);
  }
};
