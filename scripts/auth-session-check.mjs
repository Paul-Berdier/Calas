import {request} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {loadEnvFile} from 'node:process';
const root=fileURLToPath(new URL('../',import.meta.url));
try{loadEnvFile(resolve(root,'apps/web/.env'));}catch{/* CI environment */}
const fixture=JSON.parse((await readFile(resolve(root,'.cache/auth-test.json'),'utf8')).replace(/^\uFEFF/,''));
const base=fixture.baseURL;
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert(['localhost','127.0.0.1','postgres'].includes(new URL(process.env.DATABASE_URL).hostname));
const req=createRequire(realpathSync(resolve(root,'apps/web/node_modules/better-auth/package.json')));
const webRequire=createRequire(resolve(root,'apps/web/package.json'));
const {Pool}=webRequire('pg'),{createOTP}=req('@better-auth/utils/otp'),{base32}=req('@better-auth/utils/base32');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
const clients=[],reports=[];
async function call(client,path,data){const response=await client.fetch(path,{method:data?'POST':'GET',data,headers:{Origin:base},maxRedirects:0});assert(response.status()!==429,'Rate limited: run this bounded session check after the authentication window');return response;}
async function login(){const client=await request.newContext({baseURL:base});clients.push(client);assert.equal((await call(client,'/api/auth/sign-in/email/',{email:fixture.email,password:fixture.password})).status(),200);const code=await createOTP(new TextDecoder().decode(base32.decode(fixture.totpSecret))).totp();assert.equal((await call(client,'/api/auth/two-factor/verify-totp/',{code})).status(),200);assert.equal((await call(client,'/api/admin/content/pages/')).status(),200);return client;}
try{
 const expired=await login();const sessionResponse=await call(expired,'/api/auth/get-session/');const current=await sessionResponse.json();
 // Expire only the newly created session of this exact fixture account. No global state or clock change.
 const updated=await pool.query("UPDATE auth_session SET expires_at=now()-interval '1 second' WHERE id=$1 AND user_id=$2 RETURNING id",[current.session.id,current.user.id]);assert.equal(updated.rowCount,1);
 assert.equal((await call(expired,'/api/admin/content/pages/')).status(),401);assert.equal((await call(expired,'/admin/')).status(),302);reports.push({name:'Actual server-side expired session cannot access private API or admin',passed:true});
 const loggedOut=await login();assert.equal((await call(loggedOut,'/api/auth/sign-out/',{})).status(),200);assert.equal((await call(loggedOut,'/api/admin/content/pages/')).status(),401);reports.push({name:'Official sign-out invalidates the newly created session immediately',passed:true});
 await writeFile(resolve(root,'artifacts/custom-cms/auth-session-report.json'),JSON.stringify({environment:base,clockModified:false,onlyNewSessionsAffected:true,reports},null,2));console.log('Expired session and sign-out: 2 checks passed.');
}finally{await Promise.all(clients.map(client=>client.dispose()));await pool.end();}
