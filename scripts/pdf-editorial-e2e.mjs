import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

// Explicit local recipe only. Authentication state is created by the separate
// Better Auth login + MFA check; it is never committed or included in reports.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.CALAS_TEST_BASE_URL||'http://localhost:4336';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local recipe only');
const state=process.env.CALAS_TEST_STORAGE_STATE||resolve(root,'.cache/admin-state.json');
await readFile(state);
const artifacts=resolve(root,'artifacts/custom-cms/editorial-e2e');await mkdir(artifacts,{recursive:true});
const require=createRequire(resolve(root,'apps/web/package.json')),sharp=require('sharp');
const marker=randomUUID().slice(0,8),title=`Recette PDF ${marker}`,imageName=`recette-image-${marker}.png`;
const image=resolve(artifacts,imageName),replacement=resolve(artifacts,`recette-remplacement-${marker}.png`);
await sharp({create:{width:1200,height:800,channels:3,background:'#365c68'}}).png().toFile(image);
await sharp({create:{width:900,height:600,channels:3,background:'#c39a57'}}).png().toFile(replacement);
const browser=await chromium.launch({headless:true}),context=await browser.newContext({baseURL:base,storageState:state,viewport:{width:1440,height:1000}}),anonymous=await browser.newContext({baseURL:base});
const page=await context.newPage(),publicPage=await anonymous.newPage();
const reports=[],errors=[],external=[],created=[];let articleId,pdfId,imageId,failure;
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{const url=new URL(request.url());if(['http:','https:'].includes(url.protocol)&&url.origin!==base)external.push(url.origin);});
async function api(path,method='GET',data){const response=await context.request.fetch(`/api/admin/content/${path}`,{method,data,headers:{Origin:base}});const payload=await response.json().catch(()=>({error:'Réponse non JSON'}));assert(response.ok(),`${method} ${path}: ${response.status()} ${JSON.stringify(payload)}`);return payload;}
async function action(collection,id,name){const current=await api(`${collection}/${id}/`);return api(`${collection}/${id}/${name}/`,'POST',{expectedVersion:current.version});}
async function save(){await page.getByRole('button',{name:'Enregistrer le brouillon',exact:true}).click();await expect(page.getByRole('status')).toContainText('Le brouillon a été enregistré.');}
async function publish(){await page.getByRole('button',{name:'Publier',exact:true}).click();await page.getByRole('button',{name:'Confirmer la publication',exact:true}).click();await expect(page.getByRole('status')).toContainText('La publication est confirmée.');}
function pass(check){reports.push({check,result:'passed'});console.log(check);}
try{
  await page.goto('/admin/articles/');await expect(page.getByRole('heading',{name:'Le carnet Réflexions'})).toBeVisible();
  pass('1–2 · Session Better Auth avec MFA reconnue ; ouverture de Réflexions');
  for(const [collection,content] of [['people',{name:'Paul Berdier — recette locale',role:'Recette technique locale',bio:'Auteur de test identifié pour le contrôle du parcours éditorial local. Ce contenu ne doit pas être publié en production.',order:99}],['categories',{title:`Recette locale ${marker}`,slug:`recette-${marker}`,description:'Catégorie locale de recette automatisée.'}]]){
    const item=await api(`${collection}/`,'POST',{id:randomUUID(),content});created.push([collection,item.id]);await action(collection,item.id,'publish');
  }
  await page.getByRole('button',{name:'Importer un PDF',exact:true}).click();
  await page.locator('#pdf-import-file').setInputFiles(resolve(root,'artifacts/pdf-import/fixtures/texte.pdf'));
  await expect(page.getByRole('heading',{name:'Vérifier le résultat'})).toBeVisible({timeout:60000});
  await expect(page.getByLabel('Texte extrait',{exact:true})).toHaveValue(/relations/i);
  await page.getByLabel('Titre de l’article',{exact:false}).fill(title);
  await page.screenshot({path:resolve(artifacts,'01-pdf-analysis.png'),fullPage:true});
  pass('3–6 · PDF analysé localement ; texte réel présenté avant import');
  await page.getByRole('button',{name:'Créer le brouillon',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Votre article est prêt à relire.'})).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'Ouvrir le brouillon',exact:true}).click();
  await expect(page.getByLabel('Titre de l’article',{exact:false})).toHaveValue(title);
  articleId=new URL(page.url()).pathname.split('/').filter(Boolean).at(-1);created.unshift(['articles',articleId]);
  let article=await api(`articles/${articleId}/`);pdfId=article.content.sourcePdf.mediaId;
  assert.equal(article.status,'draft');assert.equal(article.content.allowPdfDownload,false);assert.equal(article.content.pdfImport.reviewed,false);
  const pdfUrl=`/media/${pdfId}/`,articleUrl=`/reflexions/${article.content.slug}/`;
  assert.equal((await anonymous.request.get(pdfUrl)).status(),404);assert.equal((await anonymous.request.get(articleUrl)).status(),404);
  const editor=page.getByRole('textbox',{name:'Texte de l’article',exact:true});await expect(editor).toContainText(/relations/i);
  await page.getByLabel('Sauvegarde automatique').uncheck();
  await editor.press('Control+End');await editor.press('Enter');await editor.pressSequentially('Phrase corrigée pour la recette éditoriale locale.');
  await page.getByLabel('Auteure',{exact:true}).selectOption(created.find(([kind])=>kind==='people')[1]);
  await page.getByLabel('Catégorie',{exact:true}).selectOption(created.find(([kind])=>kind==='categories')[1]);
  await page.getByLabel('Date de publication',{exact:false}).fill('2026-10-24T12:00');
  await save();pass('7–11 · Brouillon privé créé en base, affiché et corrigé dans Tiptap, auteur et catégorie sélectionnés');

  // Publication must reject an unchecked human review even with every other
  // editorial field present. The PDF stays private throughout this attempt.
  const rejected=await context.request.post(`/api/admin/content/articles/${articleId}/publish/`,{data:{expectedVersion:(await api(`articles/${articleId}/`)).version},headers:{Origin:base}});
  assert.equal(rejected.status(),422);assert.equal((await anonymous.request.get(pdfUrl)).status(),404);
  await page.locator('summary').filter({hasText:'PDF original et relecture'}).click();
  await page.getByLabel('J’ai relu et corrigé cet article à partir du PDF',{exact:false}).check();await save();
  await page.getByRole('button',{name:'Prévisualiser',exact:true}).click();
  await expect(page.frameLocator('iframe[title="Prévisualisation privée du brouillon"]').getByRole('heading',{name:title,exact:true})).toBeVisible();
  assert.equal((await anonymous.request.get(articleUrl)).status(),404);
  await page.screenshot({path:resolve(artifacts,'02-private-preview.png'),fullPage:true});
  await page.getByRole('complementary',{name:'Aperçu privé'}).getByRole('button',{name:'Fermer',exact:true}).click();
  pass('12–13 · Aperçu privé réel, relecture obligatoire et aucune fuite vers le public');

  // Upload and select an actual private S3 image through the media interface.
  await page.locator('summary').filter({hasText:'Image de couverture'}).click();
  await page.getByRole('button',{name:'Choisir une image',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Choisir image de couverture'});
  await dialog.locator('input[type=file]').setInputFiles(image);await dialog.getByRole('button',{name:'Importer les fichiers',exact:true}).click();
  await expect(dialog.getByRole('button',{name:`Sélectionner ${imageName}`,exact:true})).toBeVisible({timeout:30000});
  const mediaResponse=await context.request.get(`/api/admin/media/?q=${imageName}`);imageId=(await mediaResponse.json()).items[0].id;
  assert.equal((await anonymous.request.get(`/media/${imageId}/?w=320`)).status(),404);
  await dialog.getByRole('button',{name:`Sélectionner ${imageName}`,exact:true}).click();
  await page.getByLabel('Description de image de couverture',{exact:false}).fill('Aplat bleu utilisé uniquement pour la recette locale');
  await page.getByRole('button',{name:'Ajuster le point d’intérêt'}).click();await page.getByLabel('Position horizontale').fill('35');
  await save();
  pass('Médias · Import S3 privé, sélection, texte alternatif et point d’intérêt conservés');
  await publish();article=await api(`articles/${articleId}/`);const firstRevision=article.publishedRevisionId;
  await publicPage.goto('/reflexions/');await expect(publicPage.getByRole('link',{name:new RegExp(title)})).toBeVisible();
  await publicPage.goto(articleUrl);await expect(publicPage.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await expect(publicPage.getByText('Phrase corrigée pour la recette éditoriale locale.',{exact:true})).toBeVisible();
  assert.equal((await anonymous.request.get(`/media/${imageId}/?w=960`)).status(),200);assert.equal((await anonymous.request.get(pdfUrl)).status(),404);
  await page.getByLabel('Autoriser le téléchargement du PDF avec cet article publié',{exact:false}).check();await save();await publish();
  const pdfResponse=await anonymous.request.get(pdfUrl);assert.equal(pdfResponse.status(),200);assert.match(pdfResponse.headers()['content-disposition'],/^attachment/);assert.equal((await pdfResponse.body()).subarray(0,5).toString(),'%PDF-');
  await publicPage.reload();await expect(publicPage.getByRole('link',{name:/Télécharger/})).toBeVisible();
  await publicPage.screenshot({path:resolve(artifacts,'03-published-article.png'),fullPage:true});
  pass('14–16 · Article visible dans Réflexions ; image publiée ; PDF téléchargeable seulement après autorisation explicite');
  const updatedTitle=`${title} — version deux`;
  await page.getByLabel('Titre de l’article',{exact:false}).fill(updatedTitle);await save();await publicPage.reload();
  await expect(publicPage.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(publicPage.getByRole('heading',{name:updatedTitle,exact:true})).toHaveCount(0);
  await publish();await publicPage.reload();await expect(publicPage.getByRole('heading',{name:updatedTitle,exact:true})).toBeVisible();
  pass('17–19 · Modifications privées puis seconde publication, sans reconstruction');
  const revisions=(await api(`articles/${articleId}/revisions/`)).items;const previous=revisions.find(item=>item.id===firstRevision);assert(previous);
  await page.getByRole('button',{name:'Historique',exact:true}).click();
  await page.getByRole('button',{name:new RegExp(`^Version ${previous.version} ·`)}).click();
  await page.screenshot({path:resolve(artifacts,'04-history.png'),fullPage:true});
  await page.getByRole('button',{name:'Restaurer cette version',exact:true}).click();await page.getByRole('button',{name:'Restaurer en brouillon',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('La version a été restaurée');await expect(page.getByLabel('Titre de l’article',{exact:false})).toHaveValue(title);
  await publicPage.reload();await expect(publicPage.getByRole('heading',{name:updatedTitle,exact:true})).toBeVisible();
  const restored=await api(`articles/${articleId}/`);assert(restored.version>previous.version);assert.equal((await api(`articles/${articleId}/revisions/`)).items[0].action,'restored');
  pass('20 · Version antérieure restaurée dans un nouveau brouillon, historique et version publique préservés');
  for(const width of [360,390,768,1280,1440]){await page.setViewportSize({width,height:1000});await expect(page.getByLabel('Titre de l’article',{exact:false})).toHaveValue(title);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Editor overflow ${width}`);if(width===360)await page.screenshot({path:resolve(artifacts,'05-editor-mobile.png'),fullPage:true});}

  await page.goto('/admin/media/');await page.getByRole('searchbox').fill(imageName);
  await page.getByRole('button',{name:`Ouvrir ${imageName}`,exact:true}).click();dialog=page.getByRole('dialog',{name:'Détails du média'});
  await dialog.getByLabel('Texte alternatif',{exact:false}).fill('Description de recette conservée dans la médiathèque');await dialog.getByRole('button',{name:'Enregistrer le texte alternatif'}).click();
  await dialog.getByLabel('Remplacer le fichier',{exact:false}).setInputFiles(replacement);
  await dialog.getByLabel('J’autorise le remplacement de cette image',{exact:false}).check();await dialog.getByRole('button',{name:'Vérifier le remplacement'}).click();await page.getByRole('button',{name:'Confirmer le remplacement'}).click();
  await expect(page.getByRole('status')).toContainText('Le fichier a été remplacé');
  assert.equal((await context.request.get(`/api/admin/media/${imageId}/`).then(r=>r.json())).width,900);
  assert.equal((await anonymous.request.get(`/media/${imageId}/?w=320`)).status(),200);
  await dialog.getByRole('button',{name:'Supprimer si inutilisé'}).click();await page.getByRole('button',{name:'Supprimer le fichier',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText(/utilisé|référenc|historique/i);
  await page.screenshot({path:resolve(artifacts,'06-media-protected.png'),fullPage:true});
  pass('Médias · Modification des métadonnées, remplacement avec identifiant stable et refus de suppression référencée');
  await dialog.getByRole('button',{name:'Fermer la fenêtre'}).click();
  const unusedName=`recette-inutilise-${marker}.png`;
  await page.locator('input[type=file]').setInputFiles({name:unusedName,mimeType:'image/png',buffer:await readFile(image)});
  await page.getByRole('button',{name:'Importer les fichiers',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('enregistré dans la médiathèque privée');
  await page.getByRole('searchbox').fill(unusedName);await page.getByRole('button',{name:`Ouvrir ${unusedName}`,exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Détails du média'});
  const unusedUrl=await dialog.getByRole('link',{name:'Ouvrir le fichier'}).getAttribute('href');
  await dialog.getByRole('button',{name:'Supprimer si inutilisé'}).click();await page.getByRole('button',{name:'Supprimer le fichier',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Le média inutilisé a été supprimé.');assert.equal((await context.request.get(unusedUrl)).status(),404);
  pass('Médias · Fichier sans référence supprimé dans l’interface et inaccessible ensuite');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
}catch(error){failure=error.message;await page.screenshot({path:resolve(artifacts,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{
  // Keep the audit history, but remove every local fixture from public views.
  const cleanup=[];for(const [collection,id] of created){try{await action(collection,id,'archive');cleanup.push({collection,id,archived:true});}catch(error){cleanup.push({collection,id,archived:false,error:error.message});}}
  const revoked=pdfId?(await anonymous.request.get(`/media/${pdfId}/`)).status()===404:true;
  await writeFile(resolve(artifacts,'report.json'),JSON.stringify({environment:base,realServices:['Astro','Better Auth session + MFA','PostgreSQL','S3 compatible MinIO','PDF.js','Tiptap'],mockedResponses:false,reports,failure,browserErrors:errors,externalRequests:external,cleanup,pdfRevokedAfterCleanup:revoked},null,2));
  await browser.close();
  if(!failure){assert(cleanup.every(item=>item.archived),'All test fixtures must be archived');assert(revoked,'PDF must be private after cleanup');}
}
