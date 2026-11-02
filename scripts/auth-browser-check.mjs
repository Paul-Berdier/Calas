import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,expect} from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url));
const privatePath=resolve(root,'.cache/auth-test.json');
const fixture=JSON.parse((await readFile(privatePath,'utf8')).replace(/^\uFEFF/,''));
const baseURL=fixture.baseURL;
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(baseURL))throw new Error('Only a local acceptance environment is allowed.');
const req=createRequire(realpathSync(resolve(root,'apps/web/node_modules/better-auth/package.json')));
const {createOTP}=req('@better-auth/utils/otp');const {base32}=req('@better-auth/utils/base32');
const reports=[];
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({baseURL});const page=await context.newPage();
const messages=[];page.on('pageerror',error=>messages.push(error.message.replace(/token=[^&\s]+/g,'token=[redacted]')));
try{
  const anon=await context.request.get('/admin/',{maxRedirects:0});expect(anon.status()).toBe(302);
  const api=await context.request.get('/api/admin/content/pages/');expect(api.status()).toBe(401);
  reports.push({name:'Anonymous admin and API denied',passed:true});
  if(!fixture.verified){
    const inbox=await(await fetch('http://127.0.0.1:18025/api/v1/messages')).json();
    const email=inbox.messages.find(item=>item.To?.some(to=>to.Address===fixture.email)&&item.Subject.includes('Vérifier'));
    if(!email)throw new Error('Verification message not found in local mailbox.');
    const message=await(await fetch(`http://127.0.0.1:18025/api/v1/message/${email.ID}`)).json();
    const link=message.Text.match(/https?:\/\/[^\s]+\/api\/auth\/verify-email[^\s]+/)?.[0];
    if(!link||new URL(link).origin!==baseURL)throw new Error('Local verification URL invalid.');
    const verified=await page.goto(link);expect(verified.status()).toBeLessThan(400);await expect(page).toHaveURL(/\/admin\/login\//);fixture.verified=true;await writeFile(privatePath,JSON.stringify(fixture),{mode:0o600});
    reports.push({name:'Email verification through local SMTP mailbox',passed:true});
  }
  await page.goto('/admin/login/');
  await page.getByLabel('Adresse email').fill(fixture.email);
  await page.getByLabel('Mot de passe',{exact:true}).fill(fixture.password);
  await page.getByRole('button',{name:'Continuer',exact:true}).click();
  if(!fixture.enrolled){
    await page.waitForURL('**/admin/security/');
    const denied=await context.request.get('/api/admin/content/pages/');expect(denied.status()).toBe(403);
    reports.push({name:'Password-only session cannot read private content',passed:true});
    await page.getByLabel('Confirmez votre mot de passe').fill(fixture.password);
    const responsePromise=page.waitForResponse(response=>response.url().includes('/api/auth/two-factor/enable'));
    await page.getByRole('button',{name:'Configurer mon application'}).click();
    const response=await responsePromise;expect(response.status()).toBe(200);const setup=await response.json();
    fixture.totpSecret=new URL(setup.totpURI).searchParams.get('secret');fixture.backupCodes=setup.backupCodes;
    await writeFile(privatePath,JSON.stringify(fixture),{mode:0o600});
    const code=await createOTP(new TextDecoder().decode(base32.decode(fixture.totpSecret))).totp();
    await page.getByLabel('Code à six chiffres').fill(code);
    await page.getByRole('button',{name:'Activer la protection'}).click();
    await expect(page.getByRole('link',{name:'Accéder à mes contenus'})).toBeVisible();
    await page.getByRole('link',{name:'Accéder à mes contenus'}).click();
    fixture.enrolled=true;await writeFile(privatePath,JSON.stringify(fixture),{mode:0o600});
    reports.push({name:'TOTP enrollment via actual React interface and Better Auth',passed:true});
  }else{
    await expect(page.getByLabel('Code à six chiffres')).toBeVisible();
    await page.getByLabel('Code à six chiffres').fill(await createOTP(new TextDecoder().decode(base32.decode(fixture.totpSecret))).totp());
    await page.getByRole('button',{name:'Continuer',exact:true}).click();
  }
  await page.waitForURL('**/admin/');await expect(page.getByRole('heading',{level:1})).toBeVisible();
  const pages=await context.request.get('/api/admin/content/pages/');expect(pages.status()).toBe(200);
  const signup=await context.request.post('/api/auth/sign-up/email/',{headers:{Origin:baseURL},data:{email:'should-not-exist@example.test',password:fixture.password,name:'Disallowed'}});expect(signup.status()).toBe(404);
  const disable=await context.request.post('/api/auth/two-factor/disable/',{headers:{Origin:baseURL},data:{password:fixture.password}});expect(disable.status()).toBe(404);
  const csrf=await context.request.post('/api/admin/users/invite/',{headers:{Origin:'https://attacker.example'},data:{name:'Rejected',email:'rejected@example.test',role:'administrator'}});expect(csrf.status()).toBe(403);
  reports.push({name:'Authenticated content available; public registration, MFA disable and cross-origin write refused',passed:true});
  await context.storageState({path:resolve(root,'.cache/admin-state.json')});
  await mkdir(resolve(root,'artifacts/custom-cms'),{recursive:true});
  await page.screenshot({path:resolve(root,'artifacts/custom-cms/dashboard-authenticated.png'),fullPage:true});
  const report={environment:'Real local PostgreSQL + Better Auth + Mailpit; no external mail',reports,pageErrors:messages};
  await writeFile(resolve(root,'artifacts/custom-cms/auth-report.json'),JSON.stringify(report,null,2));
  expect(messages).toEqual([]);console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
