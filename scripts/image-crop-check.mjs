import {chromium,request,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),base=process.env.CALAS_TEST_BASE_URL||'http://localhost:4336';
assert(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base));
const sharp=createRequire(resolve(root,'apps/web/package.json'))('sharp');
const state=resolve(root,'.cache/admin-state.json'),api=await request.newContext({baseURL:base,storageState:state});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({baseURL:base,storageState:state,viewport:{width:1200,height:900}}),page=await context.newPage();
const id=randomUUID(),artifacts=resolve(root,'artifacts/custom-cms/images');await mkdir(artifacts,{recursive:true});let created=false;
try{
  // Three unmistakable coloured regions: a 70% left crop must show only blue.
  const png=await sharp({create:{width:1000,height:500,channels:3,background:'#0000ff'}}).composite([
    {input:await sharp({create:{width:333,height:500,channels:3,background:'#ff0000'}}).png().toBuffer(),left:0,top:0},
    {input:await sharp({create:{width:334,height:500,channels:3,background:'#00ff00'}}).png().toBuffer(),left:333,top:0},
  ]).png().toBuffer();
  const upload=await api.post('/api/admin/media/',{headers:{Origin:base},multipart:{idempotencyKey:id,file:{name:`recette-crop-${id}.png`,mimeType:'image/png',buffer:png}}});assert(upload.ok());const media=await upload.json();
  const content={title:'Recette locale du recadrage',slug:`recette-crop-${id.slice(0,8)}`,excerpt:'Contrôle technique local, jamais publié.',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Recette locale.'}]}]},allowPdfDownload:false,image:{mediaId:media.id,alt:'Bandes de recette',width:media.width,height:media.height,crop:{top:0,bottom:0,left:.7,right:0}}};
  const creation=await api.post('/api/admin/content/articles/',{headers:{Origin:base},data:{id,content}});assert(creation.ok());created=true;
  await page.goto(`/reflexions/${content.slug}/?preview=1`);await expect(page.getByRole('heading',{name:content.title,exact:true})).toBeVisible();
  const image=page.locator('.reading-cover img');await expect(image).toBeVisible();await image.evaluate(image=>image.decode());
  assert.match(await image.getAttribute('srcset'),/\?w=1920 1000w/);
  const screenshot=await page.locator('.reading-cover .cms-image-frame').screenshot({path:resolve(artifacts,'crop-right-region.png')});
  const pixels=await sharp(screenshot).removeAlpha().raw().toBuffer({resolveWithObject:true});
  // Avoid the fixed preview-status banner over the bottom of the viewport.
  for(const xFraction of [.05,.5,.95])for(const yFraction of [.05,.4,.7]){
    const offset=(Math.floor(pixels.info.height*yFraction)*pixels.info.width+Math.floor(pixels.info.width*xFraction))*pixels.info.channels;
    assert(pixels.data[offset]<20&&pixels.data[offset+1]<20&&pixels.data[offset+2]>230,'Crop must show the blue region at every sampled point');
  }
  await writeFile(resolve(artifacts,'crop-report.json'),JSON.stringify({environment:base,actualAstroComponent:true,privateDraftOnly:true,asymmetricCrop:'left 70%; only right blue region visible',pixelSamples:9,result:'passed'},null,2));console.log('Actual Astro crop: 9 pixels in the right-hand region, srcset intrinsic width correct');
}finally{
  if(created){const detail=await api.get(`/api/admin/content/articles/${id}/`).then(response=>response.json());const archived=await api.post(`/api/admin/content/articles/${id}/archive/`,{headers:{Origin:base},data:{expectedVersion:detail.version}});assert(archived.ok(),'Recipe draft archived');}
  await browser.close();await api.dispose();
}
