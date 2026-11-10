import type {ContentImage,ContentFile} from '../../lib/cms/types';
import type {MediaDto} from '../../server/media/service';
export type {MediaDto};

export async function mediaRequest<T>(path:string,options:RequestInit={}):Promise<T>{
  let response:Response;
  try{response=await fetch(path,{...options,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...options.headers}});}
  catch(error){if(error instanceof DOMException&&error.name==='AbortError')throw error;throw new Error('La connexion a été interrompue. Votre sélection est conservée ; réessayez.');}
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:data?.error?.message??'L’opération n’a pas pu être confirmée. Réessayez.');
  return data as T;
}
export function uploadFile(file:File,idempotencyKey:string){
  const form=new FormData();form.set('file',file);form.set('idempotencyKey',idempotencyKey);
  return mediaRequest<MediaDto>('/api/admin/media/',{method:'POST',body:form});
}
export function imageFromMedia(media:MediaDto):ContentImage{return {mediaId:media.id,alt:media.altText,width:media.width,height:media.height,crop:media.crop,hotspot:media.hotspot};}
export function fileFromMedia(media:MediaDto):ContentFile{return {mediaId:media.id,originalFilename:media.originalFilename,mimeType:media.mimeType,size:media.size};}
export function fileSize(bytes:number){return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(bytes>=1_000_000?bytes/1_000_000:Math.max(1,bytes/1000))+(bytes>=1_000_000?' Mo':' ko');}
