import {chromium,firefox} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {ribbonPaths} from '../assets/brand/geometry.mjs';
import {coilDuration} from '../assets/brand/coil.mjs';

const base=process.env.BASE_URL??'http://localhost:4336';
const output=resolve('artifacts/logo-coil');await mkdir(output,{recursive:true});
const reports=[];
const finalPaths=page=>page.locator('[data-shell-animate] [data-ribbon]').evaluateAll(paths=>paths.map(path=>path.getAttribute('d')));
for(const [name,type]of [['chromium',chromium],['firefox',firefox]].filter(([name])=>!process.env.CALAS_LOGO_BROWSER||process.env.CALAS_LOGO_BROWSER===name)){
 console.log(`Vérification de l’enroulement : ${name}`);
 const browser=await type.launch({headless:true});
 for(const width of [1440,390]){
  const record=name==='chromium'&&width===1440;
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'no-preference',...(record?{recordVideo:{dir:resolve(output,'live-video'),size:{width,height:1000}}}:{})});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.__coilSamples=[];
   const sample=()=>{
    const svg=document.querySelector('[data-shell-animate]');
    if(svg){const progress=Number(svg.getAttribute('data-motion-progress')||0),ready=svg.getAttribute('data-motion-ready'),rect=svg.getBoundingClientRect();window.__coilSamples.push({progress,ready,visible:getComputedStyle(svg).visibility,transform:getComputedStyle(svg).transform,box:{width:rect.width,height:rect.height},contours:[...svg.querySelectorAll('[data-ribbon]')].map(path=>path.getAttribute('d')),opacity:[...svg.querySelectorAll('[data-ribbon]')].map(path=>Number(getComputedStyle(path).opacity))});}
    if(window.__coilSamples.length<700)requestAnimationFrame(sample);
   };requestAnimationFrame(sample);
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('[data-motion-ready="true"]').waitFor();
  const shell=page.locator('[data-shell-animate]');
  if(width===390)await shell.scrollIntoViewIfNeeded();
  for(const [i,p]of [.08,.45,1].entries()){
   await page.waitForFunction(min=>Number(document.querySelector('[data-shell-animate]')?.getAttribute('data-motion-progress'))>=min,p);
   await page.screenshot({path:resolve(output,`${name}-${width}-${['start','middle','end'][i]}.png`),animations:'allow'});
  }
  await page.locator('[data-motion-complete="true"]').waitFor();
  assert.deepEqual(await finalPaths(page),ribbonPaths,'Reference contours restored byte for byte');
  const samples=await page.evaluate(()=>window.__coilSamples),active=samples.filter(s=>s.ready==='true'&&s.progress>0&&s.progress<1);
  assert(active.length>4,`${name}/${width}: several real animation frames`);
  assert(active.some(s=>s.opacity[4]>.1&&s.opacity[3]===0),'Outer ribbon precedes the nucleus');
  assert(active.some(s=>s.progress>.3&&s.progress<.8&&s.contours.some((d,i)=>d!==ribbonPaths[i])),'Intermediate state deforms the actual contours');
  assert(active.every(s=>s.transform==='none'),'No rigid transform of the logo block');
  assert(active.every(s=>Math.abs(s.box.width-active[0].box.width)<1&&Math.abs(s.box.height-active[0].box.height)<1),'Stable logo container');
  assert(!samples.some(s=>!s.ready&&s.visible!=='hidden'),'No complete-logo flash before setup');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No document overflow');
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-motion-ready="true"]').waitFor();if(width===390)await shell.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>Number(document.querySelector('[data-shell-animate]')?.getAttribute('data-motion-progress'))>.05);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('[data-shell-animate] [data-ribbon]')].map(path=>path.getAttribute('d')))===JSON.stringify(expected),ribbonPaths);
  assert.deepEqual(await finalPaths(page),ribbonPaths,'Changing motion preference restores the complete logo');
  await page.emulateMedia({reducedMotion:'no-preference'});assert.deepEqual(await finalPaths(page),ribbonPaths,'No replay after changing the preference');
  assert.deepEqual(errors,[],`${name}/${width}: no runtime errors`);
  const video=record?page.video():null;await context.close();if(video)await video.saveAs(resolve(output,'live.webm'));
  for(const mode of ['reduced','nojs']){
   const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:mode==='reduced'?'reduce':'no-preference',javaScriptEnabled:mode!=='nojs'}),page=await context.newPage();
   await page.goto(base,{waitUntil:'networkidle'});assert.deepEqual(await finalPaths(page),ribbonPaths,`${mode}: complete exact static logo`);
   assert.equal(await page.locator('[data-shell-animate]').evaluate(svg=>getComputedStyle(svg).visibility),'visible');
   await page.locator('[data-shell-animate]').screenshot({path:resolve(output,`${name}-${width}-${mode}.png`)});await context.close();
  }
  reports.push({browser:name,width,base,duration:coilDuration,checks:12,frames:active.length,result:'passed',errors});
  await writeFile(resolve(output,`report-${name}.json`),JSON.stringify({base,at:new Date().toISOString(),reports:reports.filter(report=>report.browser===name)},null,2));
 }
 await browser.close();
}
const combined=[];
for(const browser of ['chromium','firefox']){
 try{const report=JSON.parse(await readFile(resolve(output,`report-${browser}.json`),'utf8'));combined.push({...report,browser});}catch{/* This browser has not completed its checks yet. */}
}
await writeFile(resolve(output,'report.json'),JSON.stringify({at:new Date().toISOString(),runs:combined},null,2));console.log(JSON.stringify(reports));
