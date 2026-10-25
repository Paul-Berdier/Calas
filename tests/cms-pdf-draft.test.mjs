import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPdfDraft,validatePdfReview} from '../apps/studio/lib/pdf-draft.ts';

const input={id:'drafts.6beac230-c3d3-4caf-b208-c299dff787d2',assetId:`file-${'a'.repeat(40)}-pdf`,title:'Qualité du lien',excerpt:'Extrait à relire',analysis:{pageCount:2,ocrPages:1,blocks:[{_type:'block',_key:'paragraph',style:'normal',markDefs:[],children:[{_type:'span',_key:'text',text:'Texte extrait.',marks:[]}]}]}};
test('un import crée uniquement un brouillon lié au PDF et à relire, sans auteur ou date inventés',()=>{
 const draft=buildPdfDraft(input);
 assert.equal(draft._id,input.id);
 assert.equal(draft._type,'article');
 assert.equal(draft.sourcePdf.asset._ref,input.assetId);
 assert.equal(draft.pdfImport.reviewed,false);
 assert.equal(draft.author,undefined);
 assert.equal(draft.date,undefined);
 assert.match(draft.slug.current,/^qualite-du-lien-/);
 assert(draft.slug.current.length<=96);
 assert.deepEqual(buildPdfDraft(input),draft);
});
test('un identifiant publié, un faux PDF et une analyse incomplète sont refusés',()=>{
 assert.throws(()=>buildPdfDraft({...input,id:input.id.replace('drafts.','')}));
 assert.throws(()=>buildPdfDraft({...input,assetId:'image-asset-20x20-jpg'}));
 assert.throws(()=>buildPdfDraft({...input,analysis:{...input.analysis,pageCount:41}}));
 assert.throws(()=>buildPdfDraft({...input,analysis:{...input.analysis,blocks:[]}}));
});
test('la validation éditoriale bloque un PDF non relu, y compris si les métadonnées manquent',()=>{
 const draft=buildPdfDraft(input);
 assert.notEqual(validatePdfReview(undefined,draft),true);
 assert.notEqual(validatePdfReview({},draft),true);
 assert.notEqual(validatePdfReview({reviewed:false},draft),true);
 assert.equal(validatePdfReview({reviewed:true},draft),true);
 assert.equal(validatePdfReview(undefined,{_type:'article'}),true);
});
