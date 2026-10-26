import type {ZodType} from 'zod';

export class HttpError extends Error {
  constructor(public status:number,public code:string,message:string){super(message);this.name='HttpError';}
}
export function json(data:unknown,status=200):Response {
  return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
export function jsonError(error:unknown):Response {
  if(error instanceof HttpError)return json({error:{code:error.code,message:error.message}},error.status);
  return json({error:{code:'UNAVAILABLE',message:'Le service est momentanément indisponible. Votre saisie est conservée ; réessayez.'}},503);
}
export function assertSameOrigin(request:Request):void {
  const expected=new URL(process.env.BETTER_AUTH_URL||process.env.SITE_URL||'http://localhost:4321').origin;
  if(request.headers.get('origin')!==expected||new URL(request.url).origin!==expected||request.headers.get('sec-fetch-site')==='cross-site'){
    throw new HttpError(403,'ORIGIN','La demande ne peut pas être vérifiée. Rechargez la page.');
  }
}
export async function readBytes(request:Request,maxBytes:number):Promise<Uint8Array> {
  const length=request.headers.get('content-length');
  if(length&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw new HttpError(413,'TOO_LARGE','Le fichier ou la saisie dépasse la limite autorisée.');
  const reader=request.body?.getReader();
  if(!reader)return new Uint8Array();
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new HttpError(413,'TOO_LARGE','Le fichier ou la saisie dépasse la limite autorisée.');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export async function readJson<T>(request:Request,schema:ZodType<T>,maxBytes=1_048_576):Promise<T>{
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new HttpError(415,'CONTENT_TYPE','Une saisie JSON est requise.');
  let value:unknown;try{value=JSON.parse(new TextDecoder().decode(await readBytes(request,maxBytes)));}catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,'INVALID_JSON','La saisie est illisible.');}
  const result=schema.safeParse(value);if(!result.success)throw new HttpError(422,'VALIDATION',result.error.issues.slice(0,5).map(issue=>issue.message).join(' '));return result.data;
}
