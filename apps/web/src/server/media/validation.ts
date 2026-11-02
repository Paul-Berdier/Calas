import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';
import sharp from 'sharp';
import {z} from 'zod';
import type {MediaMetadata} from './schema';

export const MEDIA_LIMITS={bytes:20*1024*1024,imageBytes:12*1024*1024,pixels:32_000_000,side:12_000,pdfPages:40} as const;
export class MediaError extends Error {
  constructor(public status:number,public code:string,message:string){super(message);this.name='MediaError';}
}
export const cropSchema=z.object({top:z.number().min(0).max(.95),bottom:z.number().min(0).max(.95),left:z.number().min(0).max(.95),right:z.number().min(0).max(.95)}).refine(c=>c.top+c.bottom<.95&&c.left+c.right<.95,'Le recadrage doit conserver une partie de l’image.');
export const hotspotSchema=z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),width:z.number().min(.01).max(1),height:z.number().min(.01).max(1)});
export const mediaEditSchema=z.object({altText:z.string().max(500),crop:cropSchema.optional(),hotspot:hotspotSchema.optional(),expectedUpdatedAt:z.string().datetime()}).strict();
export function safeFilename(value:string):string{
  return value.normalize('NFC').replace(/[\\/\u0000-\u001f\u007f<>:"|?*]/g,'-').replace(/^\.+/,'').trim().slice(0,180)||'document';
}
export function detectMediaType(bytes:Uint8Array):'image/jpeg'|'image/png'|'image/webp'|'application/pdf'|null{
  const b=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
  if(b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return 'image/webp';
  if(b.length>=8&&/^%PDF-\d\.\d/.test(b.toString('ascii',0,8)))return 'application/pdf';
  return null;
}
export interface PreparedMedia {body:Buffer;mimeType:'image/jpeg'|'image/png'|'application/pdf';extension:'jpg'|'png'|'pdf';width?:number;height?:number;checksum:string;pageCount?:number;variants:Array<{width:number;height:number;body:Buffer;size:number;mimeType:string}>}
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

/** Parse untrusted PDFs away from the request thread, with memory and time
 * limits. The code is fixed; only bytes are transferred to the worker. */
export function inspectPdf(bytes:Uint8Array):Promise<number>{
  const require=createRequire(import.meta.url);
  const moduleUrl=pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href;
  return new Promise((resolve,reject)=>{
    const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');
      (async()=>{let task;try{const {getDocument}=await import(workerData.moduleUrl);
        task=getDocument({data:new Uint8Array(workerData.bytes),stopAtErrors:true,enableXfa:false,isEvalSupported:false,useWasm:false,verbosity:0});
        const pdf=await task.promise;parentPort.postMessage({pages:pdf.numPages});
      }catch{parentPort.postMessage({error:true});}finally{await task?.destroy();}})();`,
      {eval:true,workerData:{moduleUrl,bytes},resourceLimits:{maxOldGenerationSizeMb:192},stdout:true,stderr:true});
    // Parser diagnostics can contain document text; deliberately discard them.
    worker.stdout?.resume();worker.stderr?.resume();
    let settled=false;
    const finish=(pages?:number)=>{
      if(settled)return;settled=true;clearTimeout(timer);void worker.terminate();
      if(Number.isInteger(pages)&&pages!>=1&&pages!<=MEDIA_LIMITS.pdfPages)resolve(pages!);
      else reject(new MediaError(422,'INVALID_PDF','Le PDF est invalide, protégé ou dépasse la limite de 40 pages.'));
    };
    const timer=setTimeout(()=>finish(),15_000);
    worker.once('message',(result:{pages?:number})=>finish(result.pages));
    worker.once('error',()=>finish());worker.once('exit',()=>finish());
  });
}
export async function createImageVariants(bytes:Uint8Array,crop?:MediaMetadata['crop']){
  const input=Buffer.from(bytes);
  const meta=await sharp(input,{failOn:'warning',limitInputPixels:MEDIA_LIMITS.pixels}).metadata();
  const width=meta.width!,height=meta.height!;
  const left=Math.floor((crop?.left??0)*width),top=Math.floor((crop?.top??0)*height);
  const croppedWidth=Math.max(1,Math.floor(width*(1-(crop?.left??0)-(crop?.right??0))));
  const croppedHeight=Math.max(1,Math.floor(height*(1-(crop?.top??0)-(crop?.bottom??0))));
  const result:PreparedMedia['variants']=[];
  for(const target of [320,960,1920]){
    const {data,info}=await sharp(input,{failOn:'warning',limitInputPixels:MEDIA_LIMITS.pixels})
      .extract({left,top,width:Math.min(croppedWidth,width-left),height:Math.min(croppedHeight,height-top)})
      .resize({width:target,withoutEnlargement:true}).webp({quality:82,effort:4}).timeout({seconds:10}).toBuffer({resolveWithObject:true});
    result.push({width:target,height:info.height,body:data,size:data.length,mimeType:'image/webp'});
  }
  return result;
}
export async function prepareMedia(bytes:Uint8Array):Promise<PreparedMedia>{
  if(bytes.byteLength<1||bytes.byteLength>MEDIA_LIMITS.bytes)throw new MediaError(413,'FILE_SIZE','Choisissez un fichier non vide de 20 Mo maximum.');
  const type=detectMediaType(bytes);
  if(!type)throw new MediaError(415,'FILE_TYPE','Formats autorisés : JPEG, PNG, WebP et PDF. Les SVG et exécutables sont refusés.');
  const checksum=sha(bytes);
  if(type==='application/pdf')return {body:Buffer.from(bytes),mimeType:type,extension:'pdf',checksum,pageCount:await inspectPdf(bytes),variants:[]};
  if(bytes.byteLength>MEDIA_LIMITS.imageBytes)throw new MediaError(413,'IMAGE_SIZE','Cette image dépasse 12 Mo. Réduisez sa taille avant l’import.');
  try{
    const input=sharp(Buffer.from(bytes),{failOn:'warning',limitInputPixels:MEDIA_LIMITS.pixels,limitInputChannels:4});
    const meta=await input.metadata();
    if(!meta.width||!meta.height||Math.max(meta.width,meta.height)>MEDIA_LIMITS.side||meta.width*meta.height>MEDIA_LIMITS.pixels||(meta.pages??1)!==1)throw new Error('Image dimensions or frames rejected.');
    // Decode/re-encode instead of retaining attacker-controlled metadata or
    // trailing payloads. EXIF orientation is applied; metadata is stripped.
    const alpha=meta.hasAlpha===true;
    const {data,info}=await (alpha?input.rotate().png():input.rotate().jpeg({quality:92})).timeout({seconds:10}).toBuffer({resolveWithObject:true});
    if(data.length>MEDIA_LIMITS.bytes)throw new MediaError(413,'NORMALIZED_IMAGE_SIZE','Cette image reste trop volumineuse après traitement. Réduisez ses dimensions avant de l’importer.');
    return {body:data,mimeType:alpha?'image/png':'image/jpeg',extension:alpha?'png':'jpg',width:info.width,height:info.height,checksum,variants:await createImageVariants(data)};
  }catch(error){if(error instanceof MediaError)throw error;throw new MediaError(422,'INVALID_IMAGE','Cette image est endommagée, animée ou trop grande. Exportez une image fixe de moins de 32 millions de pixels.');}
}
