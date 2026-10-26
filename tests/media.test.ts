import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {prepareMedia,detectMediaType,safeFilename,mediaEditSchema,MEDIA_LIMITS} from '../apps/web/src/server/media/validation';
import {boundedBody,mediaForm} from '../apps/web/src/server/media/http';
import {paragraphsToDocument} from '../apps/web/src/features/pdf-import/pdf-import-format';
import {buildPdfArticle} from '../apps/web/src/features/pdf-import/pdf-draft';

test('media type detection rejects SVG/executables regardless of declared MIME or name',async()=>{
  for(const bytes of [Buffer.from('<svg><script>alert(1)</script></svg>'),Buffer.from('MZ fake executable'),Buffer.from('not a pdf')]){
    assert.equal(detectMediaType(bytes),null);await assert.rejects(prepareMedia(bytes),{code:'FILE_TYPE'});
  }
  await assert.rejects(prepareMedia(Buffer.from('%PDF-1.7\ncorrupted')), {code:'INVALID_PDF'});
});
test('Sharp decodes, strips metadata and generates exactly three bounded variants',async()=>{
  const input=await sharp({create:{width:1100,height:700,channels:3,background:'#94672f'}}).jpeg().withMetadata({exif:{IFD0:{Artist:'private metadata'}}}).toBuffer();
  const output=await prepareMedia(input);
  assert.equal(output.mimeType,'image/jpeg');assert.equal(output.width,1100);assert.equal(output.height,700);
  assert.deepEqual(output.variants.map(item=>item.width),[320,960,1920]);
  assert.equal((await sharp(output.body).metadata()).exif,undefined);
  assert.equal((await sharp(output.variants[2]!.body).metadata()).width,1100);
});
test('invalid image bytes and oversize inputs are rejected before storage',async()=>{
  await assert.rejects(prepareMedia(Buffer.from([255,216,255,0,0,0])),{code:'INVALID_IMAGE'});
  await assert.rejects(prepareMedia(new Uint8Array(MEDIA_LIMITS.bytes+1)),{code:'FILE_SIZE'});
  await assert.rejects(prepareMedia(new Uint8Array()),{code:'FILE_SIZE'});
});
test('real PDF parser validates synthetic text/scanned/mixed fixtures',async()=>{
  for(const [name,count] of [['texte',1],['scan',1],['mixte',2]] as const){
    const output=await prepareMedia(await readFile(new URL(`../artifacts/pdf-import/fixtures/${name}.pdf`,import.meta.url)));
    assert.equal(output.mimeType,'application/pdf');assert.equal(output.pageCount,count);assert.equal(output.variants.length,0);
  }
});
test('multipart body has a hard streaming limit and one required file',async()=>{
  const request=new Request('http://localhost/upload',{method:'POST',body:'long-content'});
  await assert.rejects(boundedBody(request,4),{code:'REQUEST_SIZE'});
  const form=new FormData();form.set('file',new File(['content'],'texte.pdf',{type:'application/pdf'}));
  const parsed=await mediaForm(new Request('http://localhost/upload',{method:'POST',body:form}));
  assert.equal(parsed.file.name,'texte.pdf');
  const invalid=new FormData();invalid.set('file','not a file');
  await assert.rejects(mediaForm(new Request('http://localhost/upload',{method:'POST',body:invalid})),{code:'FILE_REQUIRED'});
});
test('media names and crop values cannot become paths or invalid geometry',()=>{
  const filename=safeFilename('../../secret\u0000.pdf');
  assert.doesNotMatch(filename,/[\\/\u0000-\u001f]/);assert(!filename.startsWith('.'));assert(filename.endsWith('.pdf'));
  assert.equal(mediaEditSchema.safeParse({altText:'Image',expectedUpdatedAt:new Date().toISOString(),crop:{top:.7,bottom:.5,left:0,right:0}}).success,false);
});
test('PDF import produces Tiptap and keeps private/review guards with no invented author/date',()=>{
  const body=paragraphsToDocument([{text:'Un titre',style:'h2'},{text:'Le texte original.',style:'normal'}]);
  assert.deepEqual(body,{type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Un titre'}]},{type:'paragraph',content:[{type:'text',text:'Le texte original.'}]}]});
  const result=buildPdfArticle({id:'64b05849-048c-4793-bf7c-c3f16ed0bf08',title:'Relations au travail',excerpt:'Le texte original.',body,analysis:{pageCount:2,ocrPages:1},pdf:{mediaId:'8b496d9f-10e2-493b-86d5-374cb808fe94',mimeType:'application/pdf'}});
  assert.equal(result.allowPdfDownload,false);assert.equal(result.pdfImport.reviewed,false);assert(!('authorId'in result));assert(!('date'in result));
  assert.equal(result.slug,'relations-au-travail-64b05849');
});
