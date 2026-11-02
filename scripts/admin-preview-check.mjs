import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.ADMIN_QA_ORIGIN||'http://localhost:4336';
const output=resolve('artifacts/custom-cms/admin');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({storageState:JSON.parse(await readFile('.cache/admin-state.json','utf8'))});
 const page=await context.newPage(),errors=[],cases=[];page.on('pageerror',error=>errors.push(error.message));
try{
 const response=await context.request.get(`${base}/api/admin/content/pages/`);assert(response.ok());const home=(await response.json()).items.find(item=>item.kind==='home');
 await page.goto(`${base}/admin/pages/${home.id}/`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Prévisualiser',exact:true}).click();
 for(const width of [360,390,768,1280,1440]){
  await page.setViewportSize({width,height:960});
  for(const [device,viewport]of [['ordinateur',1280],['tablette',768],['mobile',390]]){
   await page.getByRole('button',{name:`Aperçu ${device}`,exact:true}).click();
   await page.frameLocator('iframe').getByRole('heading',{level:1}).waitFor();
   await page.waitForFunction(()=>{const container=document.querySelector('.admin-preview-frame'),frame=container?.querySelector('iframe');if(!container||!frame)return false;const a=container.getBoundingClientRect(),b=frame.getBoundingClientRect();return b.left>=a.left&&b.right<=a.right+1;});
   const actual=await page.frameLocator('iframe').locator('body').evaluate(()=>innerWidth);assert.equal(actual,viewport,'The real public route receives the selected viewport width');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations;
   assert.equal(violations.length,0,JSON.stringify(violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)}))));
   await page.locator('.admin-preview').screenshot({path:resolve(output,`preview-${width}-${device}.png`)});
   cases.push({width,device,viewport,insideContainer:true,violations:[]});
  }
 }
 assert.deepEqual(errors,[]);
 await page.setViewportSize({width:1440,height:960});await page.getByRole('button',{name:'Aperçu ordinateur',exact:true}).click();await page.frameLocator('iframe').getByRole('heading',{level:1}).waitFor();await page.screenshot({path:resolve(output,'page-preview-1440.png'),fullPage:true});
 await writeFile(resolve(output,'preview-report.json'),JSON.stringify({base,at:new Date().toISOString(),cases,errors},null,2));console.log(`PASS: ${cases.length} aperçus à l’échelle, viewport réel exact, sans rognage, débordement ou défaut axe.`);
}catch(error){await page.screenshot({path:resolve(output,'preview-failure.png'),fullPage:true});console.log(JSON.stringify({url:page.url(),errors,caseCount:cases.length}));throw error;}finally{await browser.close();}
