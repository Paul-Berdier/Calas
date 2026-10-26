import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),web=resolve(root,'apps/web');
const require=createRequire(resolve(web,'package.json')),astroRequire=createRequire(require.resolve('astro/package.json'));
const {createServer}=await import(pathToFileURL(astroRequire.resolve('vite')).href);
const folder=resolve(web,'.cache/pdf-cms-ui-check'),artifacts=resolve(root,'artifacts/custom-cms/pdf-import');
await mkdir(folder,{recursive:true});await mkdir(artifacts,{recursive:true});
await writeFile(resolve(folder,'index.html'),`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recette PDF — réponses HTTP simulées</title></head><body style="margin:0;background:#f7f2ea;font:15px/1.5 Arial,sans-serif"><p style="background:#14213a;color:white;text-align:center;padding:12px;margin:0">Recette locale : réponses HTTP simulées pour vérifier les reprises après incident</p><main id="root" class="admin-auth" style="display:block;min-height:auto;max-width:1060px;margin:0 auto;padding:32px 18px"></main><script type="module" src="./main.tsx"></script></body></html>`);
await writeFile(resolve(folder,'main.tsx'),`import {createRoot} from 'react-dom/client';import {PdfImport} from '/src/admin/components/PdfImport.tsx';import '/src/admin/admin.css';window.__opened=[];createRoot(document.getElementById('root')).render(<PdfImport onCreated={id=>window.__opened.push(id)}/>);`);
const server=await createServer({configFile:false,root:web,publicDir:resolve(web,'public'),worker:{format:'es'},server:{host:'127.0.0.1',port:4335,strictPort:true},logLevel:'error'});
let browser;const reports=[],external=[],errors=[],payloads=[],documents=new Map();let uploads=0,releaseUpload;
try{
  await server.listen();browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1200,height:1000},serviceWorkers:'block'});
  await context.route('**/*',route=>{
    const url=route.request().url();if(!url.startsWith('http://127.0.0.1:4335/')&&!url.startsWith('blob:')&&!url.startsWith('data:')){external.push(url);return route.abort('blockedbyclient');}
    return route.continue();
  });
  await context.route('**/api/admin/media/',async route=>{
    uploads++;await new Promise(resolve=>releaseUpload=resolve);
    await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:'8b496d9f-10e2-493b-86d5-374cb808fe94',originalFilename:'texte.pdf',mimeType:'application/pdf',size:40000,pageCount:1})});
  });
  await context.route('**/api/admin/content/articles/',async route=>{
    const body=route.request().postDataJSON();payloads.push(body);if(!documents.has(body.id))documents.set(body.id,body);
    if(payloads.length===1)return route.abort('failed');
    return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:body.id})});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4335/.cache/pdf-cms-ui-check/');
  await expect(page.getByRole('heading',{name:'Importer un article depuis un PDF'})).toBeVisible();
  await page.locator('#pdf-import-file').setInputFiles(resolve(root,'artifacts/pdf-import/fixtures/texte.pdf'));
  await expect(page.getByRole('heading',{name:'Vérifier le résultat'})).toBeVisible({timeout:60000});
  await expect(page.getByLabel('Texte extrait',{exact:true})).toHaveValue(/relations/i);
  assert.equal(uploads,0);assert.equal(payloads.length,0);reports.push({check:'Analyse locale du PDF sans upload avant confirmation',result:'passed'});
  await page.getByLabel('Titre de l’article',{exact:false}).fill('Relations au travail — recette');
  await page.getByLabel('Résumé',{exact:true}).fill('Résumé corrigé dans le formulaire de recette.');
  await page.screenshot({path:resolve(artifacts,'cms-analysis-ready.png'),fullPage:true});
  for(const width of [360,390,768,1280,1440]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`Editor overflow at ${width}`);
    if(width===360)await page.screenshot({path:resolve(artifacts,'cms-analysis-mobile-360.png'),fullPage:true});
  }
  await page.setViewportSize({width:1200,height:1000});
  await page.getByRole('button',{name:'Créer le brouillon',exact:true}).evaluate(button=>{button.click();button.click();});
  await expect.poll(()=>uploads).toBe(1);assert.equal(payloads.length,0);releaseUpload();
  await expect(page.getByRole('alert')).toContainText('Réessayez');assert.equal(payloads.length,1);
  await expect(page.getByLabel('Titre de l’article',{exact:false})).toBeDisabled();await expect(page.getByLabel('Texte extrait',{exact:true})).toBeDisabled();
  const first=payloads[0];assert.equal(first.content.allowPdfDownload,false);assert.equal(first.content.pdfImport.reviewed,false);assert.equal(first.content.body.type,'doc');assert.equal('authorId'in first.content,false);assert.equal('date'in first.content,false);
  reports.push({check:'Double clic protégé, PDF privé et relecture requise, aucun auteur/date inventé',result:'passed'});
  await page.screenshot({path:resolve(artifacts,'cms-retry-response-lost.png'),fullPage:true});
  await page.getByRole('button',{name:'Réessayer la création',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Votre article est prêt à relire.'})).toBeVisible();
  assert.equal(uploads,1);assert.equal(payloads.length,2);assert.deepEqual(payloads[0],payloads[1]);assert.equal(documents.size,1);
  reports.push({check:'Réponse perdue reprise avec un UUID/payload identique et un upload unique',result:'passed'});
  await page.getByRole('button',{name:'Ouvrir le brouillon',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.__opened),[first.id]);
  reports.push({check:'Ouverture du brouillon créé dans l’éditeur',result:'passed'});
  await page.screenshot({path:resolve(artifacts,'cms-draft-created.png'),fullPage:true});
  for(const width of [360,390,768,1280,1440]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`Overflow at ${width}`);
  }
  reports.push({check:'Aucun débordement aux largeurs 360/390/768/1280/1440',result:'passed'});
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  const report={label:'Recette du composant réel, réponses HTTP simulées uniquement pour l’incident réseau',browser:'Chromium',externalRequests:0,browserErrors:errors,reports};
  await writeFile(resolve(artifacts,'cms-ui-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
