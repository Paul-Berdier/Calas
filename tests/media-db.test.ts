import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadEnvFile} from 'node:process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import sharp from 'sharp';
import {getDb,closeDatabase} from '../apps/web/src/server/db';
import {user} from '../apps/web/src/server/db/auth-schema';
import {media} from '../apps/web/src/server/media/schema';
import {S3MediaStorage} from '../apps/web/src/server/media/storage';
import {uploadMedia,editMedia,replaceMedia,deleteMedia,listMedia,findMedia} from '../apps/web/src/server/media/service';
import {createContent,publishContent,saveContent,changePublication,isMediaPublished} from '../apps/web/src/server/content/repository';
import {GET as mediaRoute} from '../apps/web/src/pages/media/[id]';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try{loadEnvFile(resolve(root,'apps/web/.env'));}catch{/* CI supplies environment directly. */}
const require=createRequire(resolve(root,'apps/web/package.json'));
const {Pool}=require('pg');
const {migrate}=await import(pathToFileURL(require.resolve('drizzle-orm/node-postgres/migrator')).href);

test('PostgreSQL/S3 media lifecycle, privacy and publication integration',{skip:process.env.CALAS_MEDIA_INTEGRATION!=='yes'},async t=>{
  const originalUrl=new URL(process.env.DATABASE_URL??'');
  assert(['localhost','127.0.0.1','postgres'].includes(originalUrl.hostname),'Only local isolated integration databases are permitted.');
  const storageUrl=new URL(process.env.S3_ENDPOINT??'');
  assert(['localhost','127.0.0.1','minio'].includes(storageUrl.hostname),'Only local S3 is permitted.');
  const dbName=`calas_media_test_${randomUUID().replaceAll('-','')}`;
  const control=new Pool({connectionString:originalUrl.href,max:1});
  await control.query(`CREATE DATABASE "${dbName}"`);
  const testUrl=new URL(originalUrl);testUrl.pathname=`/${dbName}`;
  process.env.DATABASE_URL=testUrl.href;process.env.SITE_ENV='test';
  const storage=new S3MediaStorage({endpoint:storageUrl.href,region:process.env.S3_REGION??'us-east-1',bucket:process.env.S3_BUCKET!,accessKeyId:process.env.S3_ACCESS_KEY_ID!,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY!,forcePathStyle:true});
  const actor={id:randomUUID(),name:'Administrateur de recette',role:'administrator' as const};
  const editor={id:randomUUID(),name:'Éditeur de recette',role:'editor' as const};
  const imageBytes=await sharp({create:{width:720,height:480,channels:3,background:'#94672f'}}).jpeg().toBuffer();
  const pdfBytes=await readFile(resolve(root,'artifacts/pdf-import/fixtures/texte.pdf'));
  try{
    await migrate(getDb(),{migrationsFolder:resolve(root,'drizzle')});
    await getDb().insert(user).values([{...actor,email:`${actor.id}@example.test`,emailVerified:true},{...editor,email:`${editor.id}@example.test`,emailVerified:true}]);
    await storage.check();
    let imageId='',pdfId='';
    await t.test('uploads are real, retry-safe, sanitized and private',async()=>{
      const key=randomUUID();
      const [first,second]=await Promise.all([uploadMedia(actor,{bytes:imageBytes,filename:'test-image.jpg',idempotencyKey:key},storage),uploadMedia(actor,{bytes:imageBytes,filename:'test-image.jpg',idempotencyKey:key},storage)]);
      assert.equal(first.id,second.id);imageId=first.id;
      const row=await findMedia(imageId);assert(row);assert.equal(row.metadata.variants?.length,3);
      assert((await storage.get(row.storageKey)).length>0);assert(!('storageKey'in first));
      await assert.rejects(uploadMedia(actor,{bytes:pdfBytes,filename:'changed.pdf',idempotencyKey:key},storage),{code:'IDEMPOTENCY_CONFLICT'});
      const direct=await fetch(`${storageUrl.href.replace(/\/$/,'')}/${process.env.S3_BUCKET}/${row.storageKey}`);assert.equal(direct.status,403);
      const response=await mediaRoute({params:{id:imageId},request:new Request(`http://localhost:4321/media/${imageId}/`),url:new URL(`http://localhost:4321/media/${imageId}/`)} as never);
      assert.equal(response.status,404);assert.equal(response.headers.get('cache-control'),'private, no-store');
    });
    await t.test('editor cannot list or edit another account’s private media',async()=>{
      assert.equal((await listMedia(editor)).items.length,0);
      const row=await findMedia(imageId);assert(row);
      await assert.rejects(editMedia(editor,imageId,{altText:'Non autorisé',expectedUpdatedAt:row.updatedAt.toISOString()}),{code:'MEDIA_PERMISSION'});
    });
    await t.test('metadata saves use optimistic concurrency',async()=>{
      const row=await findMedia(imageId);assert(row);
      const updated=await editMedia(actor,imageId,{altText:'Image de recette',expectedUpdatedAt:row.updatedAt.toISOString()});assert.equal(updated.altText,'Image de recette');
      await assert.rejects(editMedia(actor,imageId,{altText:'Écrasement refusé',expectedUpdatedAt:row.updatedAt.toISOString()}),{code:'MEDIA_CONFLICT'});
    });
    const person=await createContent('person',{name:'Auteure de recette',role:'Personne synthétique de test'},actor);
    await publishContent(person.id,person.version,actor);
    const category=await createContent('category',{title:'Recette locale',slug:`recette-${randomUUID().slice(0,8)}`},actor);
    await publishContent(category.id,category.version,actor);
    const pdf=await uploadMedia(actor,{bytes:pdfBytes,filename:'texte.pdf',idempotencyKey:randomUUID()},storage);pdfId=pdf.id;
    const articleContent={title:'Article synthétique de recette',slug:`test-${randomUUID().slice(0,8)}`,excerpt:'Texte de test isolé.',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Contenu synthétique destiné uniquement à la recette.'}]}]},authorId:person.id,categoryId:category.id,date:'2020-01-01T12:00:00.000Z',image:{mediaId:imageId,alt:'Image de recette',width:720,height:480},sourcePdf:{mediaId:pdfId,mimeType:'application/pdf'},allowPdfDownload:false,pdfImport:{pageCount:1,ocrPages:0,reviewed:true}};
    let article=await createContent('article',articleContent,actor);
    await t.test('draft files remain private and used files cannot be deleted',async()=>{
      assert.equal(await isMediaPublished(imageId),false);assert.equal(await isMediaPublished(pdfId,{download:true}),false);
      const row=await findMedia(imageId);assert(row);await assert.rejects(deleteMedia(actor,imageId,row.updatedAt.toISOString(),storage),{code:'MEDIA_REFERENCED'});
    });
    await t.test('publication grants images but requires explicit PDF authorization',async()=>{
      article=await publishContent(article.id,article.version,actor);
      assert.equal(await isMediaPublished(imageId),true);assert.equal(await isMediaPublished(pdfId,{download:true}),false);
      const response=await mediaRoute({params:{id:imageId},request:new Request(`http://localhost:4321/media/${imageId}/?w=320`),url:new URL(`http://localhost:4321/media/${imageId}/?w=320`)} as never);
      assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');
      article=await saveContent(article.id,{...articleContent,allowPdfDownload:true},article.version,actor);
      assert.equal(await isMediaPublished(pdfId,{download:true}),false,'New draft never changes the active PDF grant.');
      article=await publishContent(article.id,article.version,actor);assert.equal(await isMediaPublished(pdfId,{download:true}),true);
      const download=await mediaRoute({params:{id:pdfId},request:new Request(`http://localhost:4321/media/${pdfId}/`),url:new URL(`http://localhost:4321/media/${pdfId}/`)} as never);
      assert.equal(download.status,200);assert.match(download.headers.get('content-disposition')??'',/^attachment;/);assert.equal(download.headers.get('x-content-type-options'),'nosniff');
    });
    await t.test('unpublication revokes media access while preserving historical references',async()=>{
      article=await changePublication(article.id,article.version,actor,'unpublish');
      assert.equal(await isMediaPublished(imageId),false);assert.equal(await isMediaPublished(pdfId,{download:true}),false);
      const download=await mediaRoute({params:{id:pdfId},request:new Request(`http://localhost:4321/media/${pdfId}/`),url:new URL(`http://localhost:4321/media/${pdfId}/`)} as never);assert.equal(download.status,404);
      const row=await findMedia(pdfId);assert(row);await assert.rejects(deleteMedia(actor,pdfId,row.updatedAt.toISOString(),storage),{code:'MEDIA_REFERENCED'});
    });
    await t.test('shared image replacement requires administrator confirmation and preserves references',async()=>{
      const row=await findMedia(imageId);assert(row);
      const nextBytes=await sharp({create:{width:640,height:360,channels:3,background:'#f7f2ea'}}).jpeg().toBuffer();
      await assert.rejects(replaceMedia(actor,imageId,{bytes:nextBytes,filename:'new-shared.jpg',expectedUpdatedAt:row.updatedAt.toISOString()},storage),{code:'MEDIA_REFERENCED'});
      const replacement=await replaceMedia(actor,imageId,{bytes:nextBytes,filename:'new-shared.jpg',expectedUpdatedAt:row.updatedAt.toISOString(),confirmReferences:true},storage);
      assert.equal(replacement.id,imageId);assert.equal(replacement.width,640);
      const updated=await findMedia(imageId);assert(updated);assert(updated.metadata.retiredKeys?.includes(row.storageKey));
      await assert.rejects(deleteMedia(actor,imageId,replacement.updatedAt,storage),{code:'MEDIA_REFERENCED'});
    });
    await t.test('unused media can be replaced without changing its ID and safely deleted',async()=>{
      const initial=await uploadMedia(editor,{bytes:imageBytes,filename:'unused.jpg',idempotencyKey:randomUUID()},storage);
      const nextBytes=await sharp({create:{width:500,height:500,channels:3,background:'#14213a'}}).jpeg().toBuffer();
      const replacement=await replaceMedia(editor,initial.id,{bytes:nextBytes,filename:'replacement.jpg',expectedUpdatedAt:initial.updatedAt},storage);
      assert.equal(replacement.id,initial.id);assert.equal(replacement.width,500);
      const deleted=await deleteMedia(editor,replacement.id,replacement.updatedAt,storage);assert.equal(deleted.cleanupPending,false);assert.equal(await findMedia(replacement.id),undefined);
    });
  }finally{
    try{
      const assets=await getDb().select().from(media);
      for(const asset of assets)await storage.remove([asset.storageKey,...(asset.metadata.variants??[]).map(item=>item.key),...(asset.metadata.retiredKeys??[])]);
    }finally{
      await closeDatabase();await control.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);await control.end();
    }
  }
});
