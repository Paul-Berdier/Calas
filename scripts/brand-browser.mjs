import {chromium,firefox} from '@playwright/test';
import {mkdir,writeFile,readFile,rename,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {ribbonPaths} from '../assets/brand/geometry.mjs';

const output=resolve('artifacts');
await mkdir(output,{recursive:true});
const base=process.env.BASE_URL??'http://127.0.0.1:4321';
const reports=[];
const finalPaths=page=>page.locator('[data-shell-animate] [data-ribbon]').evaluateAll(paths=>paths.map(path=>path.getAttribute('d')));
for(const [name,type]of [['chromium',chromium],['firefox',firefox]].filter(([name])=>!process.env.CALAS_LOGO_BROWSER||process.env.CALAS_LOGO_BROWSER===name)){
 console.log(`Checking logo in ${name}`);
 const browser=await type.launch({headless:true,timeout:20000});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',...(name==='chromium'?{recordVideo:{dir:resolve(output,'logo-video-temp'),size:{width:1440,height:1000}}}:{})});
 const page=await context.newPage();
 page.setDefaultTimeout(15000);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'networkidle'});
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForSelector('[data-motion-ready="true"]');
 assert.deepEqual(await finalPaths(page),ribbonPaths,`${name}: reduced-motion initial pose`);
 if(name==='chromium')await page.locator('.home-hero').screenshot({path:resolve(output,'logo-reduced-motion.png')});
 await page.emulateMedia({reducedMotion:'no-preference'});
 assert.deepEqual(await finalPaths(page),ribbonPaths,`${name}: no replay on preference toggle`);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('[data-shell-animate]')?.getAttribute('data-motion-ready')==='true');
 await page.waitForFunction(()=>document.querySelector('[data-shell-animate] path')?.getAttribute('d')?.includes('.'));
 const start=await finalPaths(page);
 assert.notDeepEqual(start,ribbonPaths,`${name}: animation must deform the paths`);
 if(name==='chromium')await page.locator('.hero-art').screenshot({path:resolve(output,'logo-start.png')});
 await page.waitForTimeout(550);
 const middle=await finalPaths(page);
 assert.notDeepEqual(middle,start,`${name}: progression`);
 if(name==='chromium')await page.locator('.hero-art').screenshot({path:resolve(output,'logo-middle.png')});
 await page.waitForSelector('[data-motion-complete="true"]');
 assert.deepEqual(await finalPaths(page),ribbonPaths,`${name}: exact final geometry restored`);
 if(name==='chromium')await page.locator('.hero-art').screenshot({path:resolve(output,'logo-end.png')});
 // Exercise preference change while the timeline is actually running.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-motion-ready="true"]');
 await page.waitForTimeout(170);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(expected=>JSON.stringify(Array.from(document.querySelectorAll('[data-shell-animate] [data-ribbon]')).map(path=>path.getAttribute('d')))===JSON.stringify(expected),ribbonPaths);
 assert.deepEqual(await finalPaths(page),ribbonPaths,`${name}: preference change restores the final pose`);
 await page.waitForTimeout(200);
 assert.deepEqual(await finalPaths(page),ribbonPaths,`${name}: preference change stops the timeline`);

 // Verify the redesign's real scroll effects, then their reduced-motion state.
 await page.emulateMedia({reducedMotion:'no-preference'});
 const artwork=page.locator('.diagnostic-visual [data-link-art]');
 await artwork.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.diagnostic-visual [data-line]')).some(line=>parseFloat(getComputedStyle(line).strokeDashoffset)>1));
 if(name==='chromium')await artwork.screenshot({path:resolve(output,'logo-link-art-start.png')});
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.diagnostic-visual [data-line]')).every(line=>!line.style.strokeDasharray));
 if(name==='chromium')await artwork.screenshot({path:resolve(output,'logo-link-art-end.png')});
 const revealObserved=await page.evaluate(()=>new Promise(resolve=>{
  const offer=document.querySelector('.offer-row');
  if(!offer){resolve(false);return;}
  const target=offer.getBoundingClientRect().top+window.scrollY-window.innerHeight*.7;
  let observed=false;
  const started=performance.now();
  window.scrollTo({top:target,behavior:'instant'});
  const sample=()=>{
   observed ||= parseFloat(getComputedStyle(offer).opacity)<.95;
   if(performance.now()-started<950)requestAnimationFrame(sample);else resolve(observed);
  };
  requestAnimationFrame(sample);
 }));
 assert.equal(revealObserved,true,`${name}: actual content reveal`);
 const readingProgress=await page.locator('.reading-progress').evaluate(bar=>new DOMMatrixReadOnly(getComputedStyle(bar).transform).a);
 assert(readingProgress>0&&readingProgress<=1,`${name}: reading progress follows the scroll`);
 await page.goto(new URL('/diagnostic-rps/',base).href,{waitUntil:'networkidle'});
 const method=page.locator('[data-method]');
 await method.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelectorAll('[data-method] [data-step-active="true"]').length===1);
 await method.locator('summary').nth(2).click();
 assert.equal(await method.locator('details').nth(2).getAttribute('open'),'');
 await page.waitForFunction(()=>document.querySelectorAll('[data-method] [data-step-active="true"]').length===1);
 await page.waitForTimeout(280); // Let the 220 ms disclosure-icon transition settle for the review capture.
 if(name==='chromium')await method.screenshot({path:resolve(output,'logo-method-progress.png')});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.querySelectorAll('[data-method] [data-step-active]').length===0);
 assert.equal(await method.evaluate(element=>element.style.getPropertyValue('--method-progress')),'',`${name}: method motion cleanup`);
 assert.equal(await method.locator('details').nth(2).getAttribute('open'),'',`${name}: reduced motion preserves the selected content`);
 assert.deepEqual(errors,[],`${name}: browser errors`);
 const video=name==='chromium'?page.video():null;
 await context.close();
 if(video){const path=await video.path();await rm(resolve(output,'logo-motion.webm'),{force:true});await rename(path,resolve(output,'logo-motion.webm'));}
 const nojs=await browser.newContext({viewport:{width:1440,height:1000},javaScriptEnabled:false});
 const staticPage=await nojs.newPage();
 await staticPage.goto(base,{waitUntil:'networkidle'});
 assert.deepEqual(await finalPaths(staticPage),ribbonPaths,`${name}: no JavaScript fallback`);
 if(name==='chromium')await staticPage.locator('.home-hero').screenshot({path:resolve(output,'logo-no-javascript.png')});
 await staticPage.goto(new URL('/diagnostic-rps/',base).href,{waitUntil:'networkidle'});
 const staticMethod=staticPage.locator('[data-method]');
 await staticMethod.locator('summary').nth(3).click();
 assert.equal(await staticMethod.locator('details').nth(3).getAttribute('open'),'',`${name}: native method disclosures without JavaScript`);
 await nojs.close();
 await browser.close();
 reports.push({browser:name,tests:['deformation effective','progression','pose finale exacte','mouvement réduit au chargement','changement de préférence pendant la timeline','absence de rejeu','fallback sans JavaScript','dessin des trajectoires au scroll','révélation des contenus au scroll','progression de lecture','progression méthode après ouverture','nettoyage méthode mouvement réduit','accordéon natif sans JavaScript'],pageErrors:errors,result:'passed'});
 await writeFile(resolve(output,`logo-browser-${name}.json`),JSON.stringify(reports.at(-1),null,2)+'\n');
 console.log(`${name}: all logo checks passed.`);
}
const storedReports=[];
for(const name of ['chromium','firefox']){try{storedReports.push(JSON.parse(await readFile(resolve(output,`logo-browser-${name}.json`),'utf8')));}catch{/* Browser not run yet. */}}
await writeFile(resolve(output,'logo-browser-report.json'),JSON.stringify({base,date:new Date().toISOString(),viewport:'1440 × 1000',reports:storedReports},null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
