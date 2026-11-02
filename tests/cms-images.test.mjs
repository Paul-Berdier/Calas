import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transform} from 'esbuild';
import {readFile} from 'node:fs/promises';
const built=await transform(await readFile(new URL('../apps/web/src/lib/cms/images.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm'});
const {imageUrl,imageSrcset,imageCropLayout,imageSlotSizes}=await import(`data:text/javascript;base64,${Buffer.from(built.code).toString('base64')}`);
const image={mediaId:'edacbd41-fd15-4eb2-a263-501d3f1f6c3e',alt:'Recette'};
test('only three bounded image variants are requested',()=>{assert.equal(imageUrl(image,300),`/media/${image.mediaId}/?w=320`);assert.equal(imageUrl(image,600),`/media/${image.mediaId}/?w=960`);assert.equal(imageUrl(image,5000),`/media/${image.mediaId}/?w=1920`);});
test('image URL never exposes provider bucket, access keys or remote URLs',()=>{const url=imageUrl({...image,storageKey:'private/key',url:'https://attacker.example'},960);assert.match(url,/^\/media\/[a-f0-9-]+\/\?w=960$/);assert(!url.includes('private'));});
test('absent, malformed and traversal references fail closed',()=>{for(const mediaId of [undefined,'../secret','https://example.com','a'.repeat(36)])assert.equal(imageUrl({...image,mediaId},300),undefined);for(const width of [NaN,Infinity,-1,0])assert.equal(imageUrl(image,width),undefined);});

test('srcset descriptors match bounded variants and non-enlarged small originals',()=>{
 assert.equal(imageSrcset(image),undefined);
 assert.equal(imageSrcset({...image,width:1200}),`/media/${image.mediaId}/?w=320 320w, /media/${image.mediaId}/?w=960 960w, /media/${image.mediaId}/?w=1920 1200w`);
 assert.equal(imageSrcset({...image,width:160}),`/media/${image.mediaId}/?w=320 160w`);
});
test('an asymmetric crop preserves precisely the selected region without a hotspot',()=>{
 const crop={top:0,bottom:0,left:.7,right:0};
 const layout=imageCropLayout({...image,width:1000,height:1000,crop},300);
 assert(Math.abs(layout.height-1000)<1e-8);
 // At the left edge of the viewport, original coordinate 700 is shown.
 assert(Math.abs(-layout.leftPercent/layout.widthPercent*1000-700)<1e-8);
 assert(Math.abs((100-layout.leftPercent)/layout.widthPercent*1000-1000)<1e-8);
});
test('hotspots cannot expose pixels outside the selected crop',()=>{
 const value={...image,width:1000,height:800,crop:{top:.1,bottom:.2,left:.2,right:.1},hotspot:{x:0,y:1,width:.1,height:.1}};
 const layout=imageCropLayout(value,400,400);
 const left=-layout.leftPercent/layout.widthPercent*1000,right=(100-layout.leftPercent)/layout.widthPercent*1000;
 const top=-layout.topPercent/layout.heightPercent*800,bottom=(100-layout.topPercent)/layout.heightPercent*800;
 assert(left>=200-1e-8&&right<=900+1e-8);assert(top>=80-1e-8&&bottom<=640+1e-8);
 assert.equal(imageSlotSizes('(max-width: 760px) 100vw, 80vw',2),'(max-width: 760px) 200vw, 160vw');
 assert.equal(imageCropLayout({...value,crop:{...value.crop,left:.9,right:.2}},300,300),undefined);
});
