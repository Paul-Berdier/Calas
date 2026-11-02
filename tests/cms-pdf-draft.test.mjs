import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPdfArticle} from '../apps/web/src/features/pdf-import/pdf-draft.ts';
import {assertPublishable} from '../apps/web/src/server/content/models.ts';

const input={id:'6beac230-c3d3-4caf-b208-c299dff787d2',pdf:{mediaId:'debe9355-d2bf-4d3a-b4d6-9d916550f237',mimeType:'application/pdf'},title:'Qualité du lien',excerpt:'Extrait à relire',analysis:{pageCount:2,ocrPages:1},body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Texte extrait.'}]}]}};
test('un import crée uniquement un brouillon lié au PDF et à relire, sans auteur ou date inventés',()=>{
 const draft=buildPdfArticle(input);
 assert.equal(draft.sourcePdf.mediaId,input.pdf.mediaId);
 assert.equal(draft.pdfImport.reviewed,false);
 assert.equal(draft.allowPdfDownload,false);
 assert.equal(draft.authorId,undefined);
 assert.equal(draft.date,undefined);
 assert.match(draft.slug,/^qualite-du-lien-/);
 assert(buildPdfArticle({...input,title:'Très long titre '.repeat(20)}).slug.length<=96);
 assert.deepEqual(buildPdfArticle(input),draft);
});
test('un identifiant invalide, un faux PDF et une analyse incomplète sont refusés',()=>{
 assert.throws(()=>buildPdfArticle({...input,id:'published-or-untrusted-id'}));
 assert.throws(()=>buildPdfArticle({...input,pdf:{...input.pdf,mimeType:'image/png'}}));
 assert.throws(()=>buildPdfArticle({...input,analysis:{...input.analysis,pageCount:41}}));
 assert.throws(()=>buildPdfArticle({...input,analysis:{...input.analysis,ocrPages:3}}));
 assert.throws(()=>buildPdfArticle({...input,body:{type:'doc',content:[]}}));
});
test('la validation éditoriale bloque un PDF non relu, y compris si les métadonnées manquent',()=>{
 const draft={...buildPdfArticle(input),authorId:input.id,categoryId:input.pdf.mediaId,date:'2020-01-01T12:00:00Z'};
 assert.throws(()=>assertPublishable('article',{...draft,pdfImport:undefined}));
 assert.throws(()=>assertPublishable('article',{...draft,pdfImport:{}}));
 assert.throws(()=>assertPublishable('article',draft));
 assert.doesNotThrow(()=>assertPublishable('article',{...draft,pdfImport:{...draft.pdfImport,reviewed:true}}));
 assert.doesNotThrow(()=>assertPublishable('article',{...draft,sourcePdf:undefined,pdfImport:undefined}));
});
