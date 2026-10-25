import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';

const require=createRequire(import.meta.url);
const origin=process.env.BASE_URL??'http://127.0.0.1:4336';
const label=process.env.CI==='true'?'ci':'mobile';
const output=resolve(`artifacts/lighthouse-custom-cms-${label}`);
await mkdir(resolve('artifacts/custom-cms'),{recursive:true});
const args=[require.resolve('lighthouse/cli/index.js'),`${origin}/`,'--output=html','--output=json',`--output-path=${output}`,
 `--chrome-flags=--headless${process.env.CI==='true'?' --no-sandbox':''}`,'--no-enable-error-reporting','--quiet'];
await new Promise((done,reject)=>{
 const child=spawn(process.execPath,args,{env:{...process.env,CHROME_PATH:chromium.executablePath()},stdio:'inherit',windowsHide:true});
 const timer=setTimeout(()=>{child.kill();reject(new Error('La mesure Lighthouse a dépassé trois minutes.'));},180000);
 child.once('error',error=>{clearTimeout(timer);reject(error);});
 child.once('exit',code=>{clearTimeout(timer);code===0?done():reject(new Error(`Lighthouse a quitté avec le code ${code}.`));});
});
const report=JSON.parse(await readFile(`${output}.report.json`,'utf8'));
const summary={date:report.fetchTime,origin,platform:process.platform,lighthouse:report.lighthouseVersion,userAgent:report.userAgent,
 formFactor:report.configSettings.formFactor,throttlingMethod:report.configSettings.throttlingMethod,throttling:report.configSettings.throttling,
 performance:Math.round(report.categories.performance.score*100),accessibility:Math.round(report.categories.accessibility.score*100),
 bestPractices:Math.round(report.categories['best-practices'].score*100),
 lcpMs:report.audits['largest-contentful-paint'].numericValue,cls:report.audits['cumulative-layout-shift'].numericValue,
 tbtMs:report.audits['total-blocking-time'].numericValue,speedIndexMs:report.audits['speed-index'].numericValue};
await writeFile(resolve(`artifacts/custom-cms/performance-${label}-report.json`),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
assert.ok(summary.performance>=90,'Performance mobile Lighthouse inférieure à 90.');
assert.equal(summary.accessibility,100,'Un défaut Lighthouse d’accessibilité doit être corrigé.');
assert.ok(summary.cls<=0.1,'Le décalage de mise en page dépasse 0,1.');
