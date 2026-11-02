import {randomUUID} from 'node:crypto';
import {and,desc,eq,ilike,sql} from 'drizzle-orm';
import {getDb} from '../db';
import {mediaReferences,auditLogs} from '../db/schema';
import {media,mediaDeletions,type MediaRow,type MediaMetadata} from './schema';
import {getMediaStorage,type MediaStorage} from './storage';
import {MediaError,prepareMedia,createImageVariants,mediaEditSchema,safeFilename,type PreparedMedia} from './validation';

export interface MediaActor {id:string;name?:string;role:'administrator'|'editor'}
export interface MediaDto {
  id:string;originalFilename:string;mimeType:string;size:number;width?:number;height?:number;altText:string;
  url:string;thumbnailUrl?:string;createdAt:string;updatedAt:string;canEdit:boolean;
  crop?:MediaMetadata['crop'];hotspot?:MediaMetadata['hotspot'];pageCount?:number;
}
export function mediaDto(row:MediaRow,actor:MediaActor):MediaDto{
  return {id:row.id,originalFilename:row.originalFilename,mimeType:row.mimeType,size:row.sizeBytes,
    width:row.width??undefined,height:row.height??undefined,altText:row.altText,
    url:`/media/${row.id}/`,thumbnailUrl:row.mimeType.startsWith('image/')?`/media/${row.id}/?w=320`:undefined,
    createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),
    canEdit:actor.role==='administrator'||row.createdBy===actor.id,
    crop:row.metadata.crop,hotspot:row.metadata.hotspot,pageCount:row.metadata.pageCount};
}
function assertEditable(row:MediaRow,actor:MediaActor){
  if(actor.role!=='administrator'&&row.createdBy!==actor.id)throw new MediaError(403,'MEDIA_PERMISSION','Seul l’administrateur ou la personne ayant importé ce média peut le modifier.');
}
function assertUuid(value:string){if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value))throw new MediaError(400,'INVALID_ID','Identifiant invalide.');}
export async function listMedia(actor:MediaActor,{search='',offset=0,imagesOnly=false,pdfOnly=false}:{search?:string;offset?:number;imagesOnly?:boolean;pdfOnly?:boolean}={}){
  const rows=await getDb().select().from(media).where(and(
    actor.role==='administrator'?undefined:sql`(${media.createdBy}=${actor.id} OR EXISTS (SELECT 1 FROM ${mediaReferences} WHERE ${mediaReferences.mediaId}=${media.id} AND ${mediaReferences.isPublished}=true))`,
    search?ilike(media.originalFilename,`%${search.slice(0,100).replace(/[\\%_]/g,'\\$&')}%`):undefined,
    imagesOnly?sql`${media.mimeType} LIKE 'image/%'`:undefined,
    pdfOnly?eq(media.mimeType,'application/pdf'):undefined,
  )).orderBy(desc(media.createdAt),desc(media.id)).limit(41).offset(Math.min(10000,Math.max(0,offset)));
  return {items:rows.slice(0,40).map(row=>mediaDto(row,actor)),hasMore:rows.length>40};
}
export async function findMedia(id:string):Promise<MediaRow|undefined>{assertUuid(id);return(await getDb().select().from(media).where(eq(media.id,id)).limit(1))[0];}
function allKeys(row:MediaRow){return [row.storageKey,...(row.metadata.variants??[]).map(variant=>variant.key),...(row.metadata.retiredKeys??[])];}
async function putPrepared(prepared:PreparedMedia,id:string,storage:MediaStorage){
  const prefix=`media/${id}/${randomUUID()}`;
  const key=`${prefix}/original.${prepared.extension}`;
  const keys:string[]=[];
  try{
    await storage.put(key,prepared.body,prepared.mimeType);keys.push(key);
    const variants:NonNullable<MediaMetadata['variants']>=[];
    for(const variant of prepared.variants){
      const variantKey=`${prefix}/${variant.width}.webp`;
      await storage.put(variantKey,variant.body,variant.mimeType);keys.push(variantKey);
      variants.push({key:variantKey,width:variant.width,height:variant.height,size:variant.size,mimeType:variant.mimeType});
    }
    return {key,keys,variants};
  }catch(error){await storage.remove(keys).catch(()=>{});throw error;}
}
export async function uploadMedia(actor:MediaActor,input:{bytes:Uint8Array;filename:string;idempotencyKey:string},storage:MediaStorage=getMediaStorage()):Promise<MediaDto>{
  assertUuid(input.idempotencyKey);
  const prepared=await prepareMedia(input.bytes);
  const uploadKey=`${actor.id}:${input.idempotencyKey}`;
  return getDb().transaction(async tx=>{
      // Serialize same-key retries across all server instances. A lost HTTP
      // response cannot create a second object or change the first payload.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${uploadKey},0))`);
      const existing=(await tx.select().from(media).where(eq(media.uploadKey,uploadKey)).limit(1))[0];
      if(existing){
        if(existing.metadata.checksum!==prepared.checksum)throw new MediaError(409,'IDEMPOTENCY_CONFLICT','Cette tentative correspond à un autre fichier. Sélectionnez à nouveau le document.');
        return mediaDto(existing,actor);
      }
      const id=randomUUID(),objects=await putPrepared(prepared,id,storage);
      const [row]=await tx.insert(media).values({id,uploadKey,storageKey:objects.key,originalFilename:safeFilename(input.filename),mimeType:prepared.mimeType,sizeBytes:prepared.body.length,
        width:prepared.width,height:prepared.height,createdBy:actor.id,
        metadata:{checksum:prepared.checksum,pageCount:prepared.pageCount,variants:objects.variants},visibility:'private'}).returning();
      await tx.insert(auditLogs).values({action:'media.upload',actorId:actor.id,actorName:actor.name??'Compte autorisé',resourceType:'media',resourceId:id,title:'Média',metadata:{mimeType:prepared.mimeType,size:prepared.body.length}});
      return mediaDto(row!,actor);
    });
  // On an uncertain PostgreSQL commit, never delete objects that might already
  // be referenced. A retry resolves the stable key; orphan cleanup is explicit.
}
export async function editMedia(actor:MediaActor,id:string,input:unknown){
  assertUuid(id);const parsed=mediaEditSchema.safeParse(input);
  if(!parsed.success)throw new MediaError(422,'MEDIA_FIELDS','Vérifiez le texte alternatif et le cadrage.');
  const edit=parsed.data;
  // Crop is stored per content occurrence by MediaPicker. Media-library edit
  // saves only defaults; it never changes already-published image bytes.
  return getDb().transaction(async tx=>{
    const [row]=await tx.select().from(media).where(eq(media.id,id)).for('update');
    if(!row)throw new MediaError(404,'MEDIA_MISSING','Ce média n’est plus disponible.');
    assertEditable(row,actor);
    if(row.updatedAt.toISOString()!==edit.expectedUpdatedAt)throw new MediaError(409,'MEDIA_CONFLICT','Ce média a été modifié depuis votre ouverture. Rechargez sa fiche avant d’enregistrer.');
    const [updated]=await tx.update(media).set({altText:edit.altText,metadata:{...row.metadata,crop:edit.crop,hotspot:edit.hotspot},updatedAt:new Date()}).where(eq(media.id,id)).returning();
    await tx.insert(auditLogs).values({action:'media.edit',actorId:actor.id,actorName:actor.name??'Compte autorisé',resourceType:'media',resourceId:id,title:'Média'});
    return mediaDto(updated!,actor);
  });
}
export async function replaceMedia(actor:MediaActor,id:string,input:{bytes:Uint8Array;filename:string;expectedUpdatedAt:string;confirmReferences?:boolean},storage:MediaStorage=getMediaStorage()){
  assertUuid(id);const prepared=await prepareMedia(input.bytes);
  return getDb().transaction(async tx=>{
      const [row]=await tx.select().from(media).where(eq(media.id,id)).for('update');
      if(!row)throw new MediaError(404,'MEDIA_MISSING','Ce média n’est plus disponible.');
      assertEditable(row,actor);
      if(row.updatedAt.toISOString()!==input.expectedUpdatedAt)throw new MediaError(409,'MEDIA_CONFLICT','Ce média a été modifié. Rechargez sa fiche avant le remplacement.');
      if((row.mimeType==='application/pdf')!==(prepared.mimeType==='application/pdf'))throw new MediaError(422,'MEDIA_KIND','Remplacez une image par une image, ou un PDF par un PDF.');
      const used=(await tx.select({id:mediaReferences.id}).from(mediaReferences).where(eq(mediaReferences.mediaId,id)).limit(1)).length>0;
      // A shared image replacement is an explicitly confirmed administrator
      // operation. PDFs always require a fresh draft/publication authorization.
      if(used&&(row.mimeType==='application/pdf'||actor.role!=='administrator'||!input.confirmReferences))throw new MediaError(409,'MEDIA_REFERENCED','Ce média est lié à des contenus. Un administrateur doit confirmer le remplacement partagé d’une image. Pour un PDF, importez un nouveau fichier dans le brouillon.');
      const objects=await putPrepared(prepared,id,storage);
      const [updated]=await tx.update(media).set({storageKey:objects.key,originalFilename:safeFilename(input.filename),mimeType:prepared.mimeType,sizeBytes:prepared.body.length,
        width:prepared.width??null,height:prepared.height??null,updatedAt:new Date(),
        metadata:{checksum:prepared.checksum,pageCount:prepared.pageCount,variants:objects.variants,retiredKeys:allKeys(row)}}).where(eq(media.id,id)).returning();
      await tx.insert(auditLogs).values({action:'media.replace',actorId:actor.id,actorName:actor.name??'Compte autorisé',resourceType:'media',resourceId:id,title:'Média',metadata:{shared:used}});
      return mediaDto(updated!,actor);
    });
}
export async function deleteMedia(actor:MediaActor,id:string,expectedUpdatedAt:string,storage:MediaStorage=getMediaStorage()){
  assertUuid(id);
  const cleanupId=randomUUID();
  await getDb().transaction(async tx=>{
    const [row]=await tx.select().from(media).where(eq(media.id,id)).for('update');
    if(!row)throw new MediaError(404,'MEDIA_MISSING','Ce média n’est plus disponible.');
    assertEditable(row,actor);
    if(row.updatedAt.toISOString()!==expectedUpdatedAt)throw new MediaError(409,'MEDIA_CONFLICT','Ce média a changé. Rechargez sa fiche avant suppression.');
    if((await tx.select({id:mediaReferences.id}).from(mediaReferences).where(eq(mediaReferences.mediaId,id)).limit(1)).length)throw new MediaError(409,'MEDIA_REFERENCED','Ce média est utilisé par un contenu ou une version conservée. Il ne peut pas être supprimé.');
    // Row lock + FK prevent concurrent references. S3 deletion follows commit;
    // the outbox records a retry if the network or storage service is unavailable.
    await tx.insert(mediaDeletions).values({id:cleanupId,keys:allKeys(row)});
    await tx.delete(media).where(eq(media.id,id));
    await tx.insert(auditLogs).values({action:'media.delete',actorId:actor.id,actorName:actor.name??'Compte autorisé',resourceType:'media',resourceId:id,title:'Média'});
  });
  const cleaned=await cleanupMediaObjects(storage,cleanupId);
  return {cleanupPending:cleaned.pending>0};
}
export async function cleanupMediaObjects(storage:MediaStorage=getMediaStorage(),id?:string){
  const rows=await getDb().select().from(mediaDeletions).where(id?eq(mediaDeletions.id,id):undefined).limit(50);
  let deleted=0,pending=0;
  for(const row of rows){
    try{await storage.remove(row.keys);await getDb().delete(mediaDeletions).where(eq(mediaDeletions.id,row.id));deleted++;}
    catch{pending++;}
  }
  return {deleted,pending};
}

/** Recipes are finite widths; a crop can only come from persisted content, not
 * arbitrary URL geometry. Public rendering can additionally use object-position. */
export function selectMediaObject(row:MediaRow,width?:number){
  if(row.mimeType==='application/pdf'||!width)return {key:row.storageKey,mimeType:row.mimeType,size:row.sizeBytes};
  const variants=row.metadata.variants??[];
  return variants.find(variant=>variant.width>=Math.min(1920,Math.max(1,width)))??variants.at(-1)??{key:row.storageKey,mimeType:row.mimeType,size:row.sizeBytes};
}

// Re-export pure image processing for offline maintenance without storage URLs.
export {createImageVariants};
