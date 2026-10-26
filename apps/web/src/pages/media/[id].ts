import type {APIRoute} from 'astro';
import {findMedia,selectMediaObject} from '../../server/media/service';
import {getMediaStorage} from '../../server/media/storage';
import {isMediaPublished} from '../../server/content/repository';
import {requireEditor} from '../../server/auth/permissions';

const unavailable=()=>new Response('Fichier indisponible.',{status:404,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
export const GET:APIRoute=async({params,request,url})=>{
  try{
    const row=await findMedia(params.id??'');if(!row)return unavailable();
    const downloadable=row.mimeType==='application/pdf';
    const published=await isMediaPublished(row.id,{download:downloadable});
    if(!published){try{const actor=await requireEditor(request);if(actor.role!=='administrator'&&row.createdBy!==actor.id)return unavailable();}catch{return unavailable();}}
    const requested=Number(url.searchParams.get('w'));
    const object=selectMediaObject(row,Number.isFinite(requested)&&requested>0?requested:undefined);
    const bytes=await getMediaStorage().get(object.key);
    const asciiName=row.originalFilename.replace(/[^\x20-\x7e]|["\\]/g,'_');
    const disposition=`${downloadable?'attachment':'inline'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.originalFilename)}`;
    return new Response(bytes as BodyInit,{headers:{
      'Content-Type':object.mimeType,'Content-Length':String(bytes.length),'Content-Disposition':disposition,
      'Cache-Control':published?'public, max-age=0, must-revalidate':'private, no-store',
      'Vary':'Cookie','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin',
      'Content-Security-Policy':"sandbox; default-src 'none'",'X-Robots-Tag':'noindex, nofollow',
    }});
  }catch{return unavailable();}
};
