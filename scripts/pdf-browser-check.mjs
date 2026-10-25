import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const studio=resolve(root,'apps/studio');
const studioRequire=createRequire(resolve(studio,'package.json'));
const sanityRequire=createRequire(studioRequire.resolve('sanity/package.json'));
const {createServer}=await import(pathToFileURL(sanityRequire.resolve('vite')).href);
const folder=resolve(studio,'.cache/pdf-check');
const artifacts=resolve(root,'artifacts/pdf-import');
await mkdir(folder,{recursive:true});
await mkdir(artifacts,{recursive:true});
await writeFile(resolve(folder,'index.html'),String.raw`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Recette locale PDF — aucun compte Sanity</title><style>body{font:18px/1.6 system-ui;max-width:900px;margin:60px auto;color:#14213a;background:#f7f2ea}pre{white-space:pre-wrap;padding:24px;background:white}button,input{font:inherit;margin:10px}</style><h1>Recette locale de l’import PDF</h1><p>Documents synthétiques. Aucun fichier envoyé à Sanity.</p><input type="file" id="pdf" accept=".pdf"><button id="cancel">Annuler</button><p role="status" id="status"></p><pre id="result"></pre><script type="module">
import {analyzePdf} from '/lib/pdf-import.ts';
let controller;
document.querySelector('#cancel').onclick=()=>controller?.abort();
document.querySelector('#pdf').onchange=async event=>{
 controller?.abort();controller=new AbortController();window.pdfResult=null;window.pdfError=null;
 document.querySelector('#result').textContent='';
 try{
  window.pdfResult=await analyzePdf(event.target.files[0],{signal:controller.signal,forceOcr:window.forceOcr===true,onProgress:p=>document.querySelector('#status').textContent=p.message});
  document.querySelector('#status').textContent='Analyse terminée';
  document.querySelector('#result').textContent=window.pdfResult.blocks.map(b=>b.children.map(s=>s.text??'').join('')).join('\n\n');
 }catch(error){window.pdfError=error.name+': '+error.message;document.querySelector('#status').textContent=window.pdfError;}
};</script></html>`);
const server=await createServer({configFile:false,root:studio,publicDir:resolve(studio,'public'),worker:{format:'es'},server:{host:'127.0.0.1',port:4334,strictPort:true},logLevel:'error'});
let browser;
try{
 await server.listen();
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1200,height:950}});
 const external=[];
 page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:4334')&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))external.push(request.url());});
 const reports=[];
 for(const [file,pages,ocr,forceOcr] of [['texte.pdf',1,0,false],['scan.pdf',1,1,false],['mixte.pdf',2,1,false],['texte.pdf',1,1,true]]){
  await page.goto('http://127.0.0.1:4334/.cache/pdf-check/');
  await page.evaluate(value=>{window.forceOcr=value;},forceOcr);
  await page.locator('#pdf').setInputFiles(resolve(artifacts,'fixtures',file));
  await page.waitForFunction(()=>window.pdfResult||window.pdfError,{},{timeout:180000});
  const error=await page.evaluate(()=>window.pdfError);
  assert.equal(error,null,`${file}: ${error}`);
  const result=await page.evaluate(()=>window.pdfResult);
  assert.equal(result.pageCount,pages);
  assert.equal(result.ocrPages,ocr);
  const text=result.blocks.map(block=>block.children.map(span=>span.text??'').join('')).join('\n');
  assert.match(text,/relations/i);
  assert.match(text,/observations/i);
  assert.match(text,/modifiable/i);
  assert(text.length>220);
  reports.push({file,forceOcr,pages:result.pageCount,ocrPages:result.ocrPages,characters:text.length,warnings:result.warnings});
  await page.screenshot({path:resolve(artifacts,`${file.replace('.pdf','')}${forceOcr?'-force':''}-result.png`),fullPage:true});
 }
 assert.deepEqual(external,[],'No external request during local extraction/OCR');
 await page.goto('http://127.0.0.1:4334/.cache/pdf-check/');
 await page.locator('#pdf').setInputFiles({name:'invalide.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a pdf')});
 await page.waitForFunction(()=>window.pdfError);
 assert.equal(await page.evaluate(()=>window.pdfResult),null);
 reports.push({check:'Invalid PDF rejected',result:'passed'});
 await page.goto('http://127.0.0.1:4334/.cache/pdf-check/');
 await page.route('**/ocr/lang/*.traineddata.gz',async route=>{await new Promise(resolve=>setTimeout(resolve,700));await route.continue().catch(()=>{});});
 const modelRequest=page.waitForRequest(request=>request.url().includes('/ocr/lang/'));
 await page.locator('#pdf').setInputFiles(resolve(artifacts,'fixtures/scan.pdf'));
 await modelRequest;
 await page.locator('#cancel').click();
 await page.waitForFunction(()=>window.pdfError);
 assert.match(await page.evaluate(()=>window.pdfError),/Abort|annul/i);
 assert.equal(await page.evaluate(()=>window.pdfResult),null);
 reports.push({check:'Cancellation during OCR model loading without result',result:'passed'});
 await writeFile(resolve(artifacts,'report.json'),JSON.stringify({externalRequests:external.length,reports},null,2));
 console.log(JSON.stringify({externalRequests:external.length,reports},null,2));
}finally{await browser?.close();await server.close();}
