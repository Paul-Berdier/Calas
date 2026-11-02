import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const base=process.env.BASE_URL??'http://127.0.0.1:4336';
const browser=await chromium.launch({headless:true});
const cases=[];
try{
 for(const width of [390,1440]){
  // On a tall mobile screen the compact hero now shows the logo immediately.
  // Use a short phone viewport to exercise the deferred offscreen path.
  const context=await browser.newContext({viewport:{width,height:width===390?600:900},isMobile:width===390,hasTouch:width===390});
  try{
   const page=await context.newPage(),scripts=[],errors=[];
   page.on('request',request=>{if(request.resourceType()==='script')scripts.push(request.url());});
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base,{waitUntil:'networkidle'});
   const initial=scripts.filter(url=>url.includes('ScrollTrigger'));
   assert.equal(initial.length,0,'The first home viewport does not download ScrollTrigger');
   if(width===390){
    const shell=page.locator('[data-shell-animate]');
    assert(await shell.evaluate(element=>element.getBoundingClientRect().top>=window.innerHeight),'The short mobile viewport keeps the logo below the fold');
    assert.equal(await shell.getAttribute('data-motion-progress'),'0','The below-fold mobile logo computes no intermediate frames');
    await shell.scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-motion-complete="true"]');
    assert.equal(await shell.getAttribute('data-motion-progress'),'1','The logo completes when brought into view');
   }
   await page.goto(new URL('/diagnostic-rps/',base).href,{waitUntil:'networkidle'});
   const before=scripts.filter(url=>url.includes('ScrollTrigger')).length;
   // Diagnostic now uses a static supplied illustration on both viewports.
   // Its continuous-motion plugin is only needed when the method is reached.
   assert.equal(before,0,'Diagnostic initially needs no scroll plugin');
   await page.locator('[data-method]').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>document.querySelectorAll('[data-method] [data-step-active="true"]').length===1);
   assert(scripts.some(url=>url.includes('ScrollTrigger')),'The method activates its continuous-motion plugin when reached');
   assert.deepEqual(errors,[],'Deferred initialization has no runtime errors');
   cases.push({width,initialScrollTriggerRequests:initial.length,lazyMethodLoads:true,errors});
  }finally{await context.close();}
 }
 const output=process.env.CALAS_BRAND_OUTPUT_DIR??'artifacts/logo-coil';
 await mkdir(output,{recursive:true});
 await writeFile(`${output}/loading-report.json`,JSON.stringify({base,at:new Date().toISOString(),cases},null,2));
 console.log(JSON.stringify(cases));
}finally{await browser.close();}
