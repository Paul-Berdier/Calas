import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequest} from '../apps/web/node_modules/astro/dist/core/app/node.js';
import {validateHost,validateForwardedHeaders} from '../apps/web/node_modules/astro/dist/core/app/validate-headers.js';
import {assertSameOrigin} from '../apps/web/src/server/http';

async function configuredDomains(site){
  const previous=process.env.SITE_URL;
  try{
    process.env.SITE_URL=site;
    const {default:configuration}=await import(`../apps/web/astro.config.mjs?origin-test=${encodeURIComponent(site)}`);
    return configuration.security.allowedDomains;
  }finally{if(previous===undefined)delete process.env.SITE_URL;else process.env.SITE_URL=previous;}
}
function request(host,forwardedHost,forwardedPort,allowedDomains){
  return createRequest({method:'GET',url:'/admin/login/',headers:{host,'x-forwarded-proto':'https','x-forwarded-host':forwardedHost,'x-forwarded-port':forwardedPort},socket:{encrypted:false,remoteAddress:'127.0.0.1'},on(){},once(){},removeListener(){}},{skipBody:true,allowedDomains,port:4321});
}

test('canonical HTTPS proxy origin uses the normalized default port while rejecting alternate ports and hosts',async()=>{
  const host='calas-web-test-production.up.railway.app';
  const patterns=await configuredDomains(`https://${host}`);
  assert.deepEqual(patterns,[{hostname:host,protocol:'https',port:''}]);
  assert.equal(validateHost(host,'https',patterns),host);
  assert.equal(validateHost(`${host}:443`,'https',patterns),`${host}:443`);
  assert.equal(validateForwardedHeaders('https',host,'443',patterns).host,host);
  assert.equal(new URL(request(host,host,'443',patterns).url).origin,`https://${host}`);
  for(const unwantedHost of ['attacker.example',`${host}.attacker.example`]){
    assert.equal(validateHost(unwantedHost,'https',patterns),undefined);
    assert.notEqual(new URL(request(unwantedHost,unwantedHost,'444',patterns).url).origin,`https://${host}`);
  }
  assert.equal(validateHost(host,'http',patterns),undefined);
  // Astro treats an empty pattern port as unconstrained. The existing mutation
  // guard still compares the exact origin, including any non-default port.
  const previous=process.env.BETTER_AUTH_URL;
  try{
    process.env.BETTER_AUTH_URL=`https://${host}`;
    const valid=request(host,host,'443',patterns);valid.headers.set('origin',`https://${host}`);
    assert.doesNotThrow(()=>assertSameOrigin(valid));
    const wrongPort=request(`${host}:444`,`${host}:444`,'444',patterns);wrongPort.headers.set('origin',`https://${host}`);
    assert.notEqual(new URL(wrongPort.url).origin,`https://${host}`);
    assert.throws(()=>assertSameOrigin(wrongPort),error=>error.status===403&&error.code==='ORIGIN');
    valid.headers.set('origin','https://attacker.example');
    assert.throws(()=>assertSameOrigin(valid),error=>error.status===403&&error.code==='ORIGIN');
  }finally{if(previous===undefined)delete process.env.BETTER_AUTH_URL;else process.env.BETTER_AUTH_URL=previous;}
});

test('an explicitly configured non-default HTTPS port remains exact',async()=>{
  const host='preview.example.test',patterns=await configuredDomains(`https://${host}:8443`);
  assert.equal(validateHost(`${host}:8443`,'https',patterns),`${host}:8443`);
  assert.equal(validateHost(host,'https',patterns),undefined);
  assert.equal(validateHost(`${host}:8444`,'https',patterns),undefined);
  assert.equal(new URL(request(`${host}:8443`,`${host}:8443`,'8443',patterns).url).origin,`https://${host}:8443`);
});

test('local HTTP development keeps localhost and loopback with a custom port',async()=>{
  const patterns=await configuredDomains('http://localhost:4321');
  assert.equal(validateHost('localhost:4321','http',patterns),'localhost:4321');
  assert.equal(validateHost('127.0.0.1:4336','http',patterns),'127.0.0.1:4336');
  assert.equal(validateHost('localhost.attacker.example:4321','http',patterns),undefined);
  const local=createRequest({method:'GET',url:'/',headers:{host:'localhost:4321'},socket:{encrypted:false,remoteAddress:'127.0.0.1'},on(){},once(){},removeListener(){}},{skipBody:true,allowedDomains:patterns,port:4321});
  assert.equal(new URL(local.url).origin,'http://localhost:4321');
});
