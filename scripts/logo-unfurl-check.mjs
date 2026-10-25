import {chromium,firefox} from '@playwright/test';
import {mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {ribbonPaths} from '../assets/brand/geometry.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:4321';
const output=resolve('artifacts/logo-unfurl');
await mkdir(output,{recursive:true});
const reports=[];
const goldArea=async bytes=>{
 const {data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
 let area=0;
 for(let i=0;i<data.length;i+=info.channels){const [r,g,b]=[data[i],data[i+1],data[i+2]];if(r>60&&r>b*1.3&&g>b*1.15)area++;}
 return area;
};
for(const [name,type] of [['chromium',chromium],['firefox',firefox]]){
 const browser=await type.launch({headless:true});
 for(const width of [1440,390]){
  const video=name==='chromium'&&width===1440;
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'no-preference',...(video?{recordVideo:{dir:resolve(output,'recording'),size:{width:1440,height:1000}}}:{})});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  // Sample DOM visibility before painting; video complements this flash check.
  await page.addInitScript(()=>{
   window.__shellPaints=[];
   const inspect=()=>{
    const shell=document.querySelector('[data-shell-animate]');
    if(shell){window.__shellPaints.push({pending:shell.hasAttribute('data-shell-pending'),ready:shell.getAttribute('data-motion-ready'),progress:shell.getAttribute('data-motion-progress'),visible:getComputedStyle(shell).visibility});}
    if(window.__shellPaints.length<150)requestAnimationFrame(inspect);
   };
   requestAnimationFrame(inspect);
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('[data-motion-ready="true"]').waitFor();
  const shell=page.locator('.hero-shell svg');
  if(width<600)await shell.evaluate(element=>element.scrollIntoView({behavior:'instant',block:'center'}));
  const initialBox=await shell.boundingBox();
  const frames=[];
  for(const progress of [.05,.22,.42,.62,.82,1]){
   await page.waitForFunction(min=>Number(document.querySelector('[data-shell-animate]')?.getAttribute('data-motion-progress'))>=min,progress);
   const bytes=await shell.screenshot({animations:'allow'});
   const actual=await shell.getAttribute('data-motion-progress');
   frames.push({progress:Number(actual),area:await goldArea(bytes),bytes});
   if(video)await writeFile(resolve(output,`phase-${frames.length}.png`),bytes);
  }
  const final=await shell.locator('[data-ribbon]').evaluateAll(paths=>paths.map(path=>path.getAttribute('d')));
  assert.deepEqual(final,ribbonPaths,`${name}/${width}: exact final mark`);
  assert.equal(await shell.locator('[mask]').count(),0,`${name}/${width}: all reveal masks removed`);
  assert(frames[0].area<frames.at(-1).area*.3,`${name}/${width}: starts as a small strand, not a complete silhouette`);
  assert(frames.slice(1,4).some(frame=>frame.area>frames[0].area*2&&frame.area<frames.at(-1).area*.85),`${name}/${width}: meaningful intermediate growth`);
  frames.slice(1).forEach((frame,index)=>assert(frame.area>=frames[index].area*.97,`${name}/${width}: growing surface`));
  const finalBox=await shell.boundingBox();
  for(const key of ['x','y','width','height'])assert(Math.abs(finalBox[key]-initialBox[key])<1,`${name}/${width}: stable ${key}`);
  const paints=await page.evaluate(()=>window.__shellPaints);
  assert(!paints.some(paint=>!paint.ready&&paint.visible!=='hidden'),`${name}/${width}: no complete-logo flash before motion`);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.deepEqual(await shell.locator('[data-ribbon]').evaluateAll(paths=>paths.map(path=>path.getAttribute('d'))),ribbonPaths);
  assert.deepEqual(errors,[]);
  if(video){
   const cells=await Promise.all(frames.map(frame=>sharp(frame.bytes).resize(300,300,{fit:'contain',background:'#14213a'}).png().toBuffer()));
   const board=await sharp({create:{width:900,height:600,channels:3,background:'#14213a'}}).composite(cells.map((input,i)=>({input,left:(i%3)*300,top:Math.floor(i/3)*300}))).png().toBuffer();
   await writeFile(resolve(output,'progression.png'),board);
  }
  const recording=video?page.video():null;
  await context.close();
  if(recording){const path=await recording.path();const target=resolve('artifacts/logo-unfurl.webm');await rm(target,{force:true});await rename(path,target);}
  reports.push({browser:name,width,checks:['small initial strand','progressive visible surface','stable wrapper','exact final logo','no first-paint flash','reduced-motion final state','clean runtime'],frames:frames.map(({progress,area})=>({progress,area}))});
 }
 await browser.close();
}
await writeFile(resolve(output,'report.json'),JSON.stringify(reports,null,2));
console.log(JSON.stringify(reports,null,2));
