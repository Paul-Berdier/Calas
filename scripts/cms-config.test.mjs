import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {prepareCms,readCmsConfig,inspectCms} from './cms-config.mjs';

function workspace(t){
 const root=mkdtempSync(resolve(tmpdir(),'calas-cms-config-'));
 for(const app of ['web','studio']){
  mkdirSync(resolve(root,`apps/${app}`),{recursive:true});
  copyFileSync(new URL(`../apps/${app}/.env.example`,import.meta.url),resolve(root,`apps/${app}/.env.example`));
 }
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 return root;
}

test('la préparation conserve le mode de travail, les secrets existants et les réglages de mail',t=>{
 const root=workspace(t);
 prepareCms(root);
 const before=readCmsConfig(root,{});
 assert.equal(before.web.CONTENT_MODE,'demo');
 assert(before.web.PREVIEW_SESSION_SECRET.length>=32);
 const envPath=resolve(root,'apps/web/.env');
 writeFileSync(envPath,readFileSync(envPath,'utf8')+'\n# réglage à préserver\nEXISTING_SETTING="custom value"\n');
 prepareCms(root,{projectId:'project01',dataset:'staging'});
 const after=readCmsConfig(root,{});
 assert.equal(after.web.PREVIEW_SESSION_SECRET,before.web.PREVIEW_SESSION_SECRET);
 assert.equal(after.web.EXISTING_SETTING,'custom value');
 assert.equal(after.web.MAIL_TRANSPORT,'simulation');
 assert.equal(after.web.PUBLIC_SANITY_PROJECT_ID,after.studio.SANITY_STUDIO_PROJECT_ID);
 assert.equal(after.web.CALAS_ALLOW_CONTENT_WRITE,'no');
});

test('un projet déjà renseigné dans le Studio est repris sans être effacé par un champ vide',t=>{
 const root=workspace(t);
 writeFileSync(resolve(root,'apps/studio/.env'),'SANITY_STUDIO_PROJECT_ID=project01\nSANITY_STUDIO_DATASET=staging\n');
 prepareCms(root);
 assert.equal(readCmsConfig(root,{}).web.PUBLIC_SANITY_PROJECT_ID,'project01');
});

test('une divergence de projet est refusée sans toucher aux fichiers',t=>{
 const root=workspace(t);
 prepareCms(root,{projectId:'project01'});
 const studioPath=resolve(root,'apps/studio/.env');
 writeFileSync(studioPath,readFileSync(studioPath,'utf8').replace('project01','project02'));
 const before=readFileSync(resolve(root,'apps/web/.env'),'utf8');
 assert.throws(()=>prepareCms(root),/diffèrent/);
 assert.equal(readFileSync(resolve(root,'apps/web/.env'),'utf8'),before);
});

test('un dataset de production ou une injection de ligne sont refusés avant écriture',t=>{
 const root=workspace(t);
 assert.throws(()=>prepareCms(root,{projectId:'project01',dataset:'production'}),/dataset de test/);
 assert.throws(()=>prepareCms(root,{projectId:'project01\nCONTENT_MODE=sanity'}),/invalide/);
});

test('le diagnostic ne révèle pas de secret et détecte localhost mélangé avec 127.0.0.1',t=>{
 const root=workspace(t);
 prepareCms(root,{projectId:'project01'});
 const config=readCmsConfig(root,{});
 config.web.SANITY_API_READ_TOKEN='fake-unit-token-never-real';
 assert(!inspectCms(config).some(check=>check.level==='missing'));
 config.studio.SANITY_STUDIO_PREVIEW_URL='http://127.0.0.1:4321';
 config.web.PUBLIC_SANITY_STUDIO_URL='http://127.0.0.1:3333';
 const checks=inspectCms(config);
 assert(checks.some(check=>check.level==='missing'&&check.message.includes('SITE_URL')));
 assert(checks.some(check=>check.level==='missing'&&check.message.includes('hôte')));
 assert(!JSON.stringify(checks).includes(config.web.SANITY_API_READ_TOKEN));
 assert(!JSON.stringify(checks).includes(config.web.PREVIEW_SESSION_SECRET));
});
