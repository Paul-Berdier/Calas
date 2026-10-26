import test from 'node:test';
import assert from 'node:assert/strict';
import {redactLog} from '../apps/web/src/server/logger.mjs';
test('logs remove recovery URL credentials and bearer credentials',()=>{const output=redactLog('GET /api/auth/reset-password/abc123secret?token=private-token&code=123456 Bearer access-token');assert(!output.includes('abc123secret'));assert(!output.includes('private-token'));assert(!output.includes('123456'));assert(!output.includes('access-token'));});
test('database errors do not disclose query payloads or connection strings',()=>{assert.equal(redactLog('Failed query: INSERT INTO article values(secret-body)\nparams: private'), 'Database operation failed; private query details omitted.');assert(!redactLog('postgresql://person:password@localhost/data').includes('password'));});
test('configured secrets are removed even outside labelled fields',()=>{const previous=process.env.TEST_LOG_SECRET;try{process.env.TEST_LOG_SECRET='unique-private-material';assert(!redactLog('Unexpected unique-private-material').includes('unique-private-material'));}finally{if(previous===undefined)delete process.env.TEST_LOG_SECRET;else process.env.TEST_LOG_SECRET=previous;}});
