import {MediaError} from './validation';

export async function boundedBody(request:Request,maximum:number):Promise<Uint8Array>{
  const length=Number(request.headers.get('content-length'));
  if(Number.isFinite(length)&&length>maximum)throw new MediaError(413,'REQUEST_SIZE','Le fichier dépasse la taille autorisée.');
  if(!request.body)throw new MediaError(400,'EMPTY_BODY','Aucun fichier reçu.');
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
      if(size>maximum){await reader.cancel();throw new MediaError(413,'REQUEST_SIZE','Le fichier dépasse la taille autorisée.');}chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}return buffer;
}
export async function mediaForm(request:Request){
  if(!request.headers.get('content-type')?.startsWith('multipart/form-data;'))throw new MediaError(415,'FORM_TYPE','L’import attend un formulaire de fichier.');
  const body=await boundedBody(request,21*1024*1024);
  try{
    const form=await new Response(body as BodyInit,{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();
    const file=form.get('file');
    if(!(file instanceof File)||form.getAll('file').length!==1)throw new MediaError(400,'FILE_REQUIRED','Sélectionnez un fichier à importer.');
    return {form,file};
  }catch(error){if(error instanceof MediaError)throw error;throw new MediaError(400,'INVALID_FORM','Le fichier n’a pas pu être reçu. Réessayez.');}
}
export async function mediaJson(request:Request):Promise<unknown>{
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new MediaError(415,'JSON_TYPE','Format de requête invalide.');
  const bytes=await boundedBody(request,16_384);
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new MediaError(400,'INVALID_JSON','La requête est invalide.');}
}
export function mediaJsonResponse(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});}
export function mediaErrorResponse(error:unknown){
  if(error instanceof Response)return error;
  if(error instanceof MediaError)return mediaJsonResponse({error:error.message,code:error.code},error.status);
  if(error instanceof Error&&'status' in error&&typeof error.status==='number'&&error.status>=400&&error.status<500)
    return mediaJsonResponse({error:error.message,code:'FORBIDDEN'},error.status);
  return mediaJsonResponse({error:'La médiathèque est momentanément indisponible. Vos contenus enregistrés sont conservés.',code:'MEDIA_UNAVAILABLE'},503);
}
