import {request} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';

// Actual local Better Auth, PostgreSQL and SMTP tests. No authentication state
// is forged and no password, TOTP secret, cookie or email token enters reports.
const root=fileURLToPath(new URL('../',import.meta.url)),base=process.env.CALAS_TEST_BASE_URL||'http://localhost:4336';
assert(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base),'Only local recipe services are permitted');
const require=createRequire(realpathSync(resolve(root,'apps/web/node_modules/better-auth/package.json')));
const {createOTP}=require('@better-auth/utils/otp'),{base32}=require('@better-auth/utils/base32');
const state=resolve(root,'.cache/admin-state.json');await readFile(state);
const admin=await request.newContext({baseURL:base,storageState:state}),clients=[admin];
const marker=randomBytes(6).toString('hex'),email=`security-${marker}@example.test`,password=`Recette-${randomBytes(24).toString('base64url')}`,newPassword=`Nouveau-${randomBytes(24).toString('base64url')}`;
const reports=[],rateWaits=[];
const safePath=path=>new URL(path,base).pathname.replace(/(\/reset-password\/)[^/]+/,'$1[redacted]');let userId,secret,backupCodes,cleanup=false,failure;
const artifacts=resolve(root,'artifacts/custom-cms');await mkdir(artifacts,{recursive:true});
async function client(storageState){const result=await request.newContext({baseURL:base,storageState});clients.push(result);return result;}
async function call(context,path,data,method=data?'POST':'GET',headers={}){
  for(let attempt=0;attempt<3;attempt++){
    const response=await context.fetch(path,{method,data,headers:{Origin:base,...headers},maxRedirects:0});
    if(response.status()!==429)return response;
    assert(attempt<2,`Rate limit remained active for ${safePath(path)}`);
    const wait=Math.min(60,Math.max(1,Number(response.headers()['retry-after'])||60));
    rateWaits.push({path:safePath(path),seconds:wait});console.log(`Fenêtre de protection active ; attente ${wait}s pour ${safePath(path)}`);
    await new Promise(resolve=>setTimeout(resolve,wait*1000));
  }
}
async function ok(context,path,data,method){const response=await call(context,path,data,method);assert(response.ok(),`${safePath(path)}: HTTP ${response.status()}`);return response.json();}
async function denied(context,path,data,accepted=[401,403,404],headers){const response=await call(context,path,data,data?'POST':'GET',headers);assert(accepted.includes(response.status()),`${safePath(path)}: expected denial, received ${response.status()}`);return response;}
async function mail(subject){
  for(let attempt=0;attempt<15;attempt++){
    const inbox=await(await fetch('http://127.0.0.1:18025/api/v1/messages')).json();
    const item=inbox.messages.find(item=>item.To?.some(to=>to.Address===email)&&item.Subject.includes(subject));
    if(item)return (await(await fetch(`http://127.0.0.1:18025/api/v1/message/${item.ID}`)).json()).Text;
    await new Promise(resolve=>setTimeout(resolve,200));
  }throw new Error(`Local recipe mail missing: ${subject}`);
}
function linkFrom(text,part){const link=text.match(/https?:\/\/[^\s]+/g)?.find(value=>value.includes(part));assert(link&&new URL(link).origin===base,'Expected local email link');return new URL(link);}
function pass(name){reports.push({name,passed:true});console.log(name);}
async function login(context,pass=password){return ok(context,'/api/auth/sign-in/email/',{email,password:pass});}
async function otp(){return createOTP(new TextDecoder().decode(base32.decode(secret))).totp();}
try{
  const anon=await client();
  await denied(anon,'/api/auth/sign-up/email/',{email,password,name:'Recette non autorisée'},[404]);
  await denied(anon,'/api/admin/content/pages/');await denied(anon,'/api/admin/media/');await denied(anon,'/api/admin/users/');
  await denied(admin,'/api/admin/users/invite/',{name:'Refus CSRF',email,role:'administrator'},[403],{Origin:'https://untrusted.example'});
  pass('Inscription publique, APIs anonymes et invitation cross-origin refusées');
  await ok(admin,'/api/admin/users/invite/',{name:`Recette sécurité ${marker}`,email,role:'editor'});
  const invitation=linkFrom(await mail('invitation'),'/admin/invitation/'),token=invitation.searchParams.get('token');assert(token);
  await denied(anon,'/api/invitations/accept/',{token,password,role:'administrator'},[422]);
  await ok(anon,'/api/invitations/accept/',{token,password});
  await denied(anon,'/api/invitations/accept/',{token,password},[400]);
  const users=await ok(admin,'/api/admin/users/');const person=users.users.find(user=>user.email===email);assert(person);userId=person.id;assert.equal(person.role,'editor');
  await denied(anon,'/api/auth/sign-in/email/',{email,password},[403]);
  const verification=linkFrom(await mail('Vérifier'),'/api/auth/verify-email');
  const verified=await call(anon,verification.href);assert([200,302].includes(verified.status()));
  pass('Invitation reçue par Mailpit, usage unique, rôle serveur et vérification email obligatoires');
  await denied(anon,'/api/auth/sign-in/email/',{email,password:`wrong-${password}`},[401]);
  await denied(anon,'/api/auth/sign-in/email/',{email:`absent-${marker}@example.test`,password},[401]);
  const enrolled=await client();await login(enrolled);
  await denied(enrolled,'/api/admin/content/pages/',undefined,[403]);
  const oldPasswordSession=await client(await enrolled.storageState());
  const setup=await ok(enrolled,'/api/auth/two-factor/enable/',{password,method:'totp'});secret=new URL(setup.totpURI).searchParams.get('secret');backupCodes=setup.backupCodes;assert(secret&&backupCodes?.length);
  await ok(enrolled,'/api/auth/two-factor/verify-totp/',{code:await otp(),trustDevice:true});
  assert.equal((await call(enrolled,'/api/admin/content/pages/')).status(),200);
  await denied(oldPasswordSession,'/api/admin/content/pages/',undefined,[401,403]);
  assert((await enrolled.storageState()).cookies.every(cookie=>!cookie.name.includes('trust_device')));
  pass('Mot de passe incorrect/inconnu refusé, TOTP activé, ancienne session pré-MFA non promue et appareil non approuvé');
  await denied(enrolled,'/api/admin/users/');
  await denied(enrolled,`/api/admin/users/${userId}/role/`,{role:'administrator'},[403]);
  await denied(enrolled,'/api/admin/users/invite/',{name:'Privilege',email:`blocked-${email}`,role:'administrator'},[403]);
  await denied(enrolled,'/api/auth/two-factor/disable/',{password},[404]);
  await denied(enrolled,'/api/auth/update-user/',{role:'administrator'},[404]);
  await denied(enrolled,'/api/auth/change-password/',{currentPassword:password,newPassword},[403],{Origin:'https://untrusted.example'});
  pass('Rôle éditeur contrôlé côté serveur ; élévation, désactivation MFA et changement cross-origin impossibles');
  const totpSession=await client();const challenge=await login(totpSession);assert.equal(challenge.twoFactorRedirect,true);
  await denied(totpSession,'/api/admin/content/pages/',undefined,[401,403]);
  const replay=await client(await totpSession.storageState());
  const validCode=await otp();await denied(totpSession,'/api/auth/two-factor/verify-totp/',{code:validCode==='000000'?'111111':'000000'},[400,401]);
  await ok(totpSession,'/api/auth/two-factor/verify-totp/',{code:validCode,trustDevice:true});
  await denied(replay,'/api/auth/two-factor/verify-totp/',{code:validCode},[400,401]);
  assert.equal((await call(totpSession,'/api/admin/content/pages/')).status(),200);
  pass('Connexion TOTP réelle, code incorrect refusé et challenge consommé une seule fois');
  const recovered=await client();assert.equal((await login(recovered)).twoFactorRedirect,true);
  await ok(recovered,'/api/auth/two-factor/verify-backup-code/',{code:backupCodes[0]});
  assert.equal((await call(recovered,'/api/admin/content/pages/')).status(),200);
  const reused=await client();await login(reused);await denied(reused,'/api/auth/two-factor/verify-backup-code/',{code:backupCodes[0]},[400,401]);
  pass('Code de secours utilisable une seule fois pour une vraie connexion');
  const current=(await ok(enrolled,'/api/auth/get-session/')).session.token;
  const sessions=await ok(recovered,'/api/auth/list-sessions/');assert(sessions.some(session=>session.token===current));
  await ok(recovered,'/api/auth/revoke-session/',{token:current});await denied(enrolled,'/api/admin/content/pages/',undefined,[401,403]);
  pass('Liste de sessions puis révocation ciblée immédiatement effective');
  await ok(anon,'/api/auth/request-password-reset/',{email,redirectTo:`${base}/admin/reset-password/`});
  const resetLink=linkFrom(await mail('Réinitialiser'),'/api/auth/reset-password/');
  const resetRedirect=await call(anon,resetLink.href);assert.equal(resetRedirect.status(),302,'The real reset email callback must open successfully');
  const resetScreen=new URL(resetRedirect.headers().location,base);assert.equal(resetScreen.origin,base);const resetToken=resetScreen.searchParams.get('token');assert(resetToken);
  await ok(anon,'/api/auth/reset-password/',{newPassword,token:resetToken});
  await denied(anon,'/api/auth/reset-password/',{newPassword:password,token:resetToken},[400,401]);
  await denied(recovered,'/api/admin/content/pages/',undefined,[401,403]);await denied(totpSession,'/api/admin/content/pages/',undefined,[401,403]);
  const afterReset=await client();assert.equal((await login(afterReset,newPassword)).twoFactorRedirect,true);
  await ok(afterReset,'/api/auth/two-factor/verify-backup-code/',{code:backupCodes[1]});
  assert.equal((await call(afterReset,'/api/admin/content/pages/')).status(),200);
  pass('Lien réel de réinitialisation Mailpit, jeton unique, anciennes sessions révoquées, nouveau mot de passe et MFA conservée');
  await ok(admin,`/api/admin/users/${userId}/revoke/`,{});await denied(afterReset,'/api/admin/content/pages/',undefined,[401,403]);
  await ok(admin,`/api/admin/users/${userId}/disable/`,{});cleanup=true;
  pass('Révocation administrative et désactivation du seul utilisateur créé pour la recette');
}catch(error){failure=error.message.replace(/token[=:][^&\s]+/gi,'token=[redacted]');throw new Error(failure);}
finally{
  if(!cleanup){try{if(!userId){const users=await ok(admin,'/api/admin/users/');userId=users.users.find(user=>user.email===email)?.id;}if(userId){await ok(admin,`/api/admin/users/${userId}/disable/`,{});cleanup=true;}}catch{/* Visible in report; never hide cleanup failure. */}}
  await writeFile(resolve(artifacts,'auth-security-report.json'),JSON.stringify({environment:base,services:'Real PostgreSQL, Better Auth and local Mailpit; no external email',mockedResponses:false,reports,rateLimitWaits:rateWaits,failure,createdUserDisabled:cleanup},null,2));
  await Promise.all(clients.map(context=>context.dispose()));
  if(!failure)assert(cleanup,'Created test user must be disabled');
}
