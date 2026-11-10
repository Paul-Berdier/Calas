import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnvFile} from 'node:process';

const root=fileURLToPath(new URL('../',import.meta.url));
try{loadEnvFile(resolve(root,'apps/web/.env'));}catch{/* CI provides the environment. */}
const fixture=JSON.parse((await readFile(resolve(root,'.cache/auth-test.json'),'utf8')).replace(/^\uFEFF/,''));
const base=fixture.baseURL;
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert(['localhost','127.0.0.1','postgres'].includes(new URL(process.env.DATABASE_URL).hostname));
const req=createRequire(realpathSync(resolve(root,'apps/web/node_modules/better-auth/package.json')));
const webRequire=createRequire(resolve(root,'apps/web/package.json'));
const {Pool}=webRequire('pg'),{createOTP}=req('@better-auth/utils/otp'),{base32}=req('@better-auth/utils/base32');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
const browser=await chromium.launch({headless:true});
const report={environment:base,existingStaleSession:process.argv.includes('--existing-stale'),checks:[],errors:[]};
const output=resolve(root,'artifacts/custom-cms');
await mkdir(output,{recursive:true});
const otp=()=>createOTP(new TextDecoder().decode(base32.decode(fixture.totpSecret))).totp();
async function loginApi(context){
 const password=await context.request.post(`${base}/api/auth/sign-in/email/`,{headers:{Origin:base},data:{email:fixture.email,password:fixture.password,rememberMe:false}});
 assert.equal(password.status(),200,'The fixture can start a fresh password session');
 const verified=await context.request.post(`${base}/api/auth/two-factor/verify-totp/`,{headers:{Origin:base},data:{code:await otp(),trustDevice:false}});
 assert.equal(verified.status(),200,'The real TOTP challenge completes');
 const current=await(await context.request.get(`${base}/api/auth/get-session/`)).json();
 assert.equal(current.user.email,fixture.email);
 return current;
}
async function ageOnlyFixtureSession(current){
 assert.equal(current.user.email,fixture.email);
 const result=await pool.query("UPDATE auth_session SET created_at=now()-interval '15 minutes 1 second' WHERE id=$1 AND user_id=$2 RETURNING id",[current.session.id,current.user.id]);
 assert.equal(result.rowCount,1,'Only this exact fixture session is aged');
}
let raceContext;
try{
 const state=report.existingStaleSession?JSON.parse(await readFile(resolve(root,'.cache/admin-state.json'),'utf8')):undefined;
 const context=await browser.newContext({baseURL:base,storageState:state,viewport:{width:1440,height:960}});
 if(!report.existingStaleSession)await ageOnlyFixtureSession(await loginApi(context));
 const current=await(await context.request.get('/api/auth/get-session/')).json();
 assert.equal(current.user.email,fixture.email);
 assert.equal((await context.request.get('/api/admin/content/pages/')).status(),200,'An old session still accesses ordinary editorial content');
 const refused=await context.request.get('/api/auth/list-sessions/');
 assert.equal(refused.status(),403);
 assert.equal((await refused.json()).code,'SESSION_NOT_FRESH');
 report.checks.push('Real server refuses an old session while editorial access remains valid');

 const page=await context.newPage(),listRequests=[],browserErrors=[];
 page.on('request',request=>{if(new URL(request.url()).pathname.replace(/\/$/,'')==='/api/auth/list-sessions')listRequests.push(request.url());});
 page.on('pageerror',error=>browserErrors.push(error.message));
 page.on('console',entry=>{if(entry.type()==='error')browserErrors.push(entry.text());});
 await page.clock.install();
 await page.goto('/admin/security/',{waitUntil:'networkidle'});
 await expect(page.getByRole('button',{name:'Se reconnecter',exact:true})).toBeVisible();
 assert.equal(listRequests.length,0,'The stale screen makes no doomed list request');
 assert.equal(await page.locator('.auth-session').count(),0);
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:960});
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  assert.deepEqual(audit.violations,[],`Stale-session explanation is accessible at ${width}px`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:resolve(output,`security-stale-${width}.png`),fullPage:true});
 }
 report.checks.push('Old-session UI explains reconnection without a failed GET, at 390 and 1440px');

 const signOut=page.waitForResponse(response=>new URL(response.url()).pathname.replace(/\/$/,'')==='/api/auth/sign-out');
 await page.getByRole('button',{name:'Se reconnecter',exact:true}).click();
 assert.equal((await signOut).status(),200);
 await expect(page).toHaveURL(/\/admin\/login\/\?returnTo=security$/);
 await page.getByLabel('Adresse email').fill(fixture.email);
 await page.getByLabel('Mot de passe',{exact:true}).fill(fixture.password);
 await page.getByRole('button',{name:'Continuer',exact:true}).click();
 await expect(page.getByLabel('Code à six chiffres')).toBeVisible();
 await page.getByLabel('Code à six chiffres').fill(await otp());
 const freshList=page.waitForResponse(response=>new URL(response.url()).pathname.replace(/\/$/,'')==='/api/auth/list-sessions');
 await page.getByRole('button',{name:'Continuer',exact:true}).click();
 await expect(page).toHaveURL(/\/admin\/security\/$/);
 assert.equal((await freshList).status(),200);
 await expect(page.locator('.auth-session').first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Se reconnecter',exact:true})).toHaveCount(0);
 await context.storageState({path:resolve(root,'.cache/admin-state.json')});
 report.checks.push('Verified sign-out, password, real TOTP, return to security, and list-sessions 200');

 const beforeTimer=listRequests.length;
 await page.clock.fastForward(15*60*1000+1000);
 await expect(page.getByRole('button',{name:'Se reconnecter',exact:true})).toBeVisible();
 assert.equal(await page.locator('.auth-session').count(),0);
 assert.equal(listRequests.length,beforeTimer,'The client expiry timer does not issue a failing request');
 assert.deepEqual(browserErrors,[],'The normal stale/reconnect/timer flow has no browser errors');
 report.checks.push('An open tab stops displaying its session list when the client freshness timer expires');
 await context.close();

 // A distinct newly-created fixture session expires between SSR and its GET.
 // The real API handles the request: no mocked response or bypass is used.
 raceContext=await browser.newContext({baseURL:base});
 const racing=await loginApi(raceContext),racePage=await raceContext.newPage();
 const errors=[];racePage.on('pageerror',error=>errors.push(error.message));
 let aged=false;
 await racePage.route('**/api/auth/list-sessions**',async route=>{
  assert.equal(aged,false,'Only the initial session-list request is sent');
  aged=true;await ageOnlyFixtureSession(racing);await route.continue();
 });
 const raceResponse=racePage.waitForResponse(response=>new URL(response.url()).pathname.replace(/\/$/,'')==='/api/auth/list-sessions');
 await racePage.goto('/admin/security/');
 const expired=await raceResponse;assert.equal(expired.status(),403);
 assert.equal((await expired.json()).code,'SESSION_NOT_FRESH');
 await expect(racePage.getByRole('button',{name:'Se reconnecter',exact:true})).toBeVisible();
 await expect(racePage.getByText('La liste des sessions n’a pas pu être chargée.',{exact:false})).toHaveCount(0);
 assert.deepEqual(errors,[]);
 report.checks.push('A real server expiry between SSR and GET becomes the reconnection state');
}catch(error){report.errors.push(error.message);process.exitCode=1;}
finally{
 if(raceContext){await raceContext.request.post('/api/auth/sign-out/',{headers:{Origin:base},data:{}}).catch(()=>{});await raceContext.close();}
 await browser.close();await pool.end();
 await writeFile(resolve(output,'auth-freshness-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
