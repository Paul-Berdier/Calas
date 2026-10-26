import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {prepareLocal} from './local-prepare.mjs';
function workspace(t){const root=mkdtempSync(resolve(tmpdir(),'calas-local-'));mkdirSync(resolve(root,'apps/web'),{recursive:true});t.after(()=>rmSync(root,{recursive:true,force:true}));return root;}
test('local configuration generates private distinct secrets and explicit demo mode',t=>{const root=workspace(t);const {webPath}=prepareLocal(root);const data=readFileSync(webPath,'utf8');assert.match(data,/CONTENT_MODE=demo/);assert.match(data,/BETTER_AUTH_SECRET=[a-f0-9]{64}/);assert.match(data,/DATABASE_URL=postgresql:/);assert.match(data,/AUTH_MAIL_TRANSPORT=local/);assert.match(data,/MAIL_TRANSPORT=simulation/);});
test('repeating local preparation preserves credentials byte for byte',t=>{const root=workspace(t);const paths=prepareLocal(root);const before=readFileSync(paths.webPath,'utf8');prepareLocal(root);assert.equal(readFileSync(paths.webPath,'utf8'),before);});
test('existing database, storage and mail values are not overwritten',t=>{const root=workspace(t);const path=resolve(root,'apps/web/.env');writeFileSync(path,'SITE_ENV=staging\nCONTENT_MODE=database\nDATABASE_URL=custom-database\nBETTER_AUTH_SECRET=existing-private-value\nSMTP_TO=another@example.test\n');prepareLocal(root);const data=readFileSync(path,'utf8');for(const value of ['CONTENT_MODE=database','DATABASE_URL=custom-database','BETTER_AUTH_SECRET=existing-private-value','SMTP_TO=another@example.test'])assert(data.includes(value));});
test('local preparation refuses production before changing files',t=>{const root=workspace(t);const path=resolve(root,'apps/web/.env');const previous='SITE_ENV=production\n';writeFileSync(path,previous);assert.throws(()=>prepareLocal(root),/production/);assert.equal(readFileSync(path,'utf8'),previous);});
test('configuration contains no initial account or default admin password',t=>{const root=workspace(t);const {webPath}=prepareLocal(root);assert.doesNotMatch(readFileSync(webPath,'utf8'),/INIT_ADMIN|ADMIN_PASSWORD|password123/);});
