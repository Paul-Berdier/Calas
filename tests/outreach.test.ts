import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignInputSchema,prospectInputSchema,publicPathSchema,queueInputSchema} from '../apps/web/src/server/outreach/validation';
import {digest,emailDigest,makeToken,seal,unseal,validToken} from '../apps/web/src/server/outreach/tokens';
import {classifyMailError,deliverOutreachMail,mailContent} from '../apps/web/src/server/outreach/mail';
import {outreachTransport,outreachMaxBatch} from '../apps/web/src/server/outreach/service';

test('prospect imports require provenance, prior information and valid collection date',()=>{
 const contact={email:'Pro@Example.test',name:'Marie',company:'Entreprise',jobTitle:'Direction',source:'Rencontre professionnelle',sourceDate:new Date().toISOString().slice(0,10),informationConfirmed:true};
 assert.equal(prospectInputSchema.parse(contact).email,'pro@example.test');
 for(const patch of [{informationConfirmed:false},{source:''},{sourceDate:'2026-02-30'},{sourceDate:'2999-01-01'},{email:'pro@example.test\r\nBcc:other@example.test'}])assert.equal(prospectInputSchema.safeParse({...contact,...patch}).success,false);
});
test('targets exclude credentials, external redirects, private endpoints and query tracking identifiers',()=>{
 for(const path of ['/','/diagnostic-rps/','/reflexions/management/'])assert(publicPathSchema.safeParse(path).success);
 for(const path of ['https://evil.test','//evil.test/','/admin/','/api/ready/','/r/secret/','/media/uuid/','/%2e%2e/admin/','/contact/?email=user@example.test','/contact/#token'])assert(!publicPathSchema.safeParse(path).success,path);
 assert(!campaignInputSchema.safeParse({title:'Test',subject:'Bonjour\nBcc:Other',body:'Présentation professionnelle',targetPath:'/'}).success);
});
test('queue requires explicit confirmation and deduplicates the selected contact list',()=>{
 const id='6e9d3c65-746c-46ab-89b2-6aa5bd0270f4';
 assert.deepEqual(queueInputSchema.parse({version:0,contactIds:[id,id],confirmation:true}).contactIds,[id]);
 assert(!queueInputSchema.safeParse({version:0,contactIds:[id],confirmation:false}).success);
});
test('campaign and opposition tokens are random, separate, encrypted and authenticated',()=>{
 const old=process.env.OUTREACH_LINK_SECRET;process.env.OUTREACH_LINK_SECRET='x'.repeat(48);
 try{const campaign=makeToken('c'),unsubscribe=makeToken('u');assert(validToken(campaign,'c'));assert(!validToken(campaign,'u'));assert(validToken(unsubscribe,'u'));assert.notEqual(makeToken('c'),campaign);assert(!validToken('c_short','c'));const sealed=seal(campaign);assert.equal(unseal(sealed),campaign);assert(!sealed.includes(campaign));assert.notEqual(seal(campaign),sealed);assert.notEqual(digest(campaign),digest(unsubscribe));assert.equal(emailDigest('FOO@example.test'),emailDigest('foo@example.test'));assert.throws(()=>unseal(sealed.slice(0,10)+'A'+sealed.slice(11)));process.env.OUTREACH_LINK_SECRET='y'.repeat(48);assert.throws(()=>unseal(sealed));}finally{if(old===undefined)delete process.env.OUTREACH_LINK_SECRET;else process.env.OUTREACH_LINK_SECRET=old;}
});
test('uncertain SMTP acceptance is never retried automatically',()=>{
 assert.equal(classifyMailError({code:'ECONNECTION',command:'DATA'}),'uncertain');
 assert.equal(classifyMailError({code:'ETIMEDOUT'}),'uncertain');
 assert.equal(classifyMailError({command:'CONN',code:'ECONNREFUSED'}),'retry');
 assert.equal(classifyMailError({responseCode:451,command:'DATA'}),'retry');
 assert.equal(classifyMailError({responseCode:550}),'failed');
 assert.equal(classifyMailError({command:'AUTH'}),'failed');
});
test('simulation never calls SMTP; default remains simulation even in production',async()=>{
 const old=process.env.OUTREACH_MAIL_TRANSPORT;delete process.env.OUTREACH_MAIL_TRANSPORT;
 try{assert.equal(outreachTransport(),'simulation');assert(outreachMaxBatch()<=5000);assert.equal(await deliverOutreachMail({id:'test',email:'test@example.test',subject:'Bonjour',body:'Démonstration',campaignLink:'/r/c_test',unsubscribeLink:'/r/u_test',source:'Recette',transport:'simulation'}),'simulated');}finally{if(old!==undefined)process.env.OUTREACH_MAIL_TRANSPORT=old;}
});
test('mail has a shared campaign link and a separate opposition link with sender and source notice',()=>{
 const old=process.env.SITE_URL;process.env.SITE_URL='https://www.calas-conseil.fr';
 try{const text=mailContent({id:'test',email:'test@example.test',subject:'Sujet',body:'Présentation',campaignLink:'/r/c_shared',unsubscribeLink:'/r/u_private',source:'Salon professionnel',transport:'simulation'});assert(text.includes('https://www.calas-conseil.fr/r/c_shared'));assert(text.includes('https://www.calas-conseil.fr/r/u_private'));assert(text.includes('/confidentialite/'));assert(text.includes('Salon professionnel'));assert(!text.includes('test@example.test'));}finally{if(old===undefined)delete process.env.SITE_URL;else process.env.SITE_URL=old;}
});
