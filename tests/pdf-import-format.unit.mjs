import test from 'node:test';
import assert from 'node:assert/strict';
import {transform} from 'esbuild';
import {readFile} from 'node:fs/promises';

// Compile only the pure formatting/limits helper in memory. No PDF, model,
// browser, account, server or network resource is needed for these tests.
const sources=await Promise.all(['pdf-import.types.ts','pdf-import-format.ts'].map(file=>readFile(new URL(`../apps/web/src/features/pdf-import/${file}`,import.meta.url),'utf8')));
const source=sources.map(text=>text.replace(/^import .*;\r?\n/gm,'')).join('\n');
const built=await transform(source,{loader:'ts',format:'esm'});
const helpers=await import(`data:text/javascript;base64,${Buffer.from(built.code).toString('base64')}`);
const {validatePdfFile,validatePageCount,validateCharacterCount,cleanText,titleFromFilename,excerptFromText,ocrTextToParagraphs,textItemsToParagraphs,paragraphsToDocument,shouldRecognizePage}=helpers;
const item=(str,x,y,height=12,width=str.length*6,hasEOL=true)=>({str,transform:[height,0,0,height,x,y],height,width,hasEOL});

test('limits reject an entire oversized document rather than truncating it',()=>{
  assert.doesNotThrow(()=>validatePdfFile({name:'article.pdf',type:'application/pdf',size:20*1024*1024}));
  assert.throws(()=>validatePdfFile({name:'article.pdf',type:'application/pdf',size:20*1024*1024+1}),/20 Mo/);
  assert.throws(()=>validatePdfFile({name:'article.pdf',type:'application/pdf',size:0}),/vide/);
  assert.throws(()=>validatePdfFile({name:'image.png',type:'image/png',size:100}),/format PDF/);
  assert.doesNotThrow(()=>validatePageCount(40));
  assert.throws(()=>validatePageCount(41),/Aucune page/);
  assert.throws(()=>validatePageCount(0),/aucune page/);
  assert.doesNotThrow(()=>validateCharacterCount(200_000));
  assert.throws(()=>validateCharacterCount(200_001),/aucun article tronqué/);
});
test('title comes from filename and excerpt is a literal beginning, never a summary',()=>{
  assert.equal(titleFromFilename('Relations_au_travail.pdf'),'Relations au travail');
  assert.equal(titleFromFilename('RPS - retour terrain.PDF'),'RPS - retour terrain');
  const source='Un premier constat précis. '.repeat(40);
  const excerpt=excerptFromText(source);
  assert(excerpt.length<=500);
  assert(source.startsWith(excerpt));
  assert.equal(excerptFromText('A\n\nB\tC'),'A B C');
});
test('PDF fragments form lines, headings and paragraphs in source order',()=>{
  const paragraphs=textItemsToParagraphs([
    item('Titre lu dans le PDF',30,800,24),
    item('Un texte',30,760,12,45,false),item('sélectionnable.',80,760,12),
    item('La phrase continue.',30,746,12),
    item('Un autre paragraphe.',30,710,12),
    item('Début de la colonne suivante.',310,760,12),
  ]);
  assert.deepEqual(paragraphs,[
    {text:'Titre lu dans le PDF',style:'h2'},
    {text:'Un texte sélectionnable. La phrase continue.',style:'normal'},
    {text:'Un autre paragraphe.',style:'normal'},
    {text:'Début de la colonne suivante.',style:'normal'},
  ]);
});
test('OCR paragraphs become editable Tiptap JSON without invented marks or attribution',()=>{
  const paragraphs=ocrTextToParagraphs('Premier paragraphe\nsur deux lignes.\n\nDeuxième paragraphe.');
  const document=paragraphsToDocument(paragraphs);
  assert.equal(document.type,'doc');
  assert.deepEqual(document.content.map(block=>block.content[0].text),['Premier paragraphe sur deux lignes.','Deuxième paragraphe.']);
  assert(document.content.every(block=>block.type==='paragraph'&&block.content[0].type==='text'&&!block.content[0].marks));
  assert.equal(cleanText('Texte\u0000 visible\u00ad.\r\nSuite'),'Texte visible.\nSuite');
});
test('automatic OCR catches scans and small native headers; full OCR also covers rich-text hybrid pages',()=>{
  const rich='Un contenu natif déjà complet avec plusieurs phrases. '.repeat(10);
  assert.equal(shouldRecognizePage('',true),true);
  assert.equal(shouldRecognizePage('Petit en-tête sélectionnable',true),true);
  assert.equal(shouldRecognizePage('Texte court sans bitmap',false),false);
  assert.equal(shouldRecognizePage(rich,true),false);
  assert.equal(shouldRecognizePage(rich,true,true),true);
  assert.equal(shouldRecognizePage(rich,false,true),true);
  assert.equal(shouldRecognizePage(rich+'\uFFFD'.repeat(6),true),true);
});
