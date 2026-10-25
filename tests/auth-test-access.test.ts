import {test} from 'node:test';
import assert from 'node:assert/strict';
import {usesTestPasswordOnly,hasRequiredAuthentication} from '../apps/web/src/server/auth/access-policy';
import {configurationProblems} from '../apps/web/src/server/config';
import {getAuth} from '../apps/web/src/server/auth';
import {getActor,requireEditor,requireAdministrator} from '../apps/web/src/server/auth/permissions';
import {closeDatabase} from '../apps/web/src/server/db';
import {ALL as authRoute} from '../apps/web/src/pages/api/auth/[...all]';

const identity={id:'recipe-account-one',email:'owner@example.test',emailVerified:true,disabled:false,role:'administrator',twoFactorEnabled:false};
const session={user:{...identity,name:'Recipe owner'},session:{mfaVerified:false}};
const request=new Request('https://recipe.example.test/api/admin/content/pages/');
const defaults={SITE_ENV:'staging',AUTH_TEST_PASSWORD_ONLY_USER_ID:identity.id,BETTER_AUTH_URL:'https://recipe.example.test',SITE_URL:'https://recipe.example.test',BETTER_AUTH_SECRET:'test-only-not-a-real-secret'.repeat(3),DATABASE_URL:'postgres://not_used:not_used@127.0.0.1:1/never_connect'};

async function withEnvironment(overrides:Record<string,string|undefined>,work:()=>unknown){
  const values={...defaults,...overrides},previous=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
  try{for(const [key,value]of Object.entries(values)){if(value===undefined)delete process.env[key];else process.env[key]=value;}return await work();}
  finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}

test('only the exact verified reserved recipe identity may omit MFA in staging',async()=>{
  await withEnvironment({},()=>{
    assert.equal(usesTestPasswordOnly(identity),true);
    assert.equal(hasRequiredAuthentication(session),true);
    assert.equal(session.session.mfaVerified,false,'The exception never forges an MFA result.');
    for(const change of [{id:'other-account'},{email:'owner@example.com'},{email:'owner@sub.example.test'},{emailVerified:false},{disabled:true},{disabled:undefined},{disabled:null},{role:'viewer'},{role:undefined},{twoFactorEnabled:true},{twoFactorEnabled:undefined},{twoFactorEnabled:null}]){
      assert.equal(usesTestPasswordOnly({...identity,...change}),false,JSON.stringify(change));
      assert.equal(hasRequiredAuthentication({...session,user:{...session.user,...change}}),false,JSON.stringify(change));
    }
    assert.equal(usesTestPasswordOnly({...identity,role:'editor'}),true,'A role change does not elevate the account.');
  });
});

test('production, missing configuration and other environments require completed MFA',async()=>{
  for(const environment of ['production','development','test','staging ',undefined])await withEnvironment({SITE_ENV:environment},()=>assert.equal(hasRequiredAuthentication(session),false));
  for(const target of ['',undefined,'another-account'])await withEnvironment({AUTH_TEST_PASSWORD_ONLY_USER_ID:target},()=>assert.equal(hasRequiredAuthentication(session),false));
  await withEnvironment({SITE_ENV:'production'},()=>{
    assert.equal(usesTestPasswordOnly(identity),false);
    assert.equal(hasRequiredAuthentication({...session,user:{...session.user,twoFactorEnabled:true},session:{mfaVerified:true}}),true);
    assert(configurationProblems().includes('AUTH_TEST_PASSWORD_ONLY_USER_ID interdit en production'));
  });
});

test('server permission guards preserve anonymous, verification, suspension, role and production restrictions',async t=>{
  await withEnvironment({},async()=>{
    const auth=getAuth();let result:unknown=session;
    const stub=t.mock.method(auth.api,'getSession',async()=>result);
    try{
      assert.equal((await getActor(request))?.id,identity.id);
      assert.equal((await requireAdministrator(request)).id,identity.id);
      for(const [value,code]of [[null,'UNAUTHENTICATED'],[{...session,user:{...session.user,disabled:true}},'UNAUTHENTICATED'],[{...session,user:{...session.user,emailVerified:false}},'EMAIL_REQUIRED'],[{...session,user:{...session.user,id:'other-account'}},'MFA_REQUIRED']]){
        result=value;assert.equal(await getActor(request),null);
        await assert.rejects(requireEditor(request),(error:any)=>error.code===code);
      }
      result={...session,user:{...session.user,role:'editor'}};
      assert.equal((await requireEditor(request)).role,'editor');
      await assert.rejects(requireAdministrator(request),(error:any)=>error.code==='FORBIDDEN');
      result={...session,user:{...session.user,role:'viewer',twoFactorEnabled:true},session:{mfaVerified:true}};
      assert.equal(await getActor(request),null);await assert.rejects(requireEditor(request),(error:any)=>error.code==='FORBIDDEN');
      result=session;process.env.SITE_ENV='production';
      assert.equal(await getActor(request),null);await assert.rejects(requireEditor(request),(error:any)=>error.code==='MFA_REQUIRED');
    }finally{stub.mock.restore();await closeDatabase();}
  });
});

test('all factor setup and recovery routes are refused for the targeted password-only session',async t=>{
  await withEnvironment({},async()=>{
    const stub=t.mock.method(getAuth().api,'getSession',async()=>session);
    try{
      for(const path of ['enable','verify-totp','verify-backup-code','generate-backup-codes']){
        const url=new URL(`/api/auth/two-factor/${path}/`,defaults.SITE_URL);
        const response=await authRoute({params:{all:`two-factor/${path}`},url,request:new Request(url,{method:'POST',headers:{origin:defaults.SITE_URL,'content-type':'application/json'},body:'{}'})} as never);
        assert.equal(response.status,409,path);assert.equal((await response.json()).error.code,'TEST_PASSWORD_ONLY');
      }
      const url=new URL('/api/auth/two-factor/enable/',defaults.SITE_URL);
      const foreign=await authRoute({params:{all:'two-factor/enable'},url,request:new Request(url,{method:'POST',headers:{origin:'https://attacker.example'},body:'{}'})} as never);
      assert.equal(foreign.status,403,'The origin check still runs before the exception.');
    }finally{stub.mock.restore();await closeDatabase();}
  });
});
