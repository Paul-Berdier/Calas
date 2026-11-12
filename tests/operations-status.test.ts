import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedBackupDay, getOperationsStatus, inspectBackupMarkers, probePublicSite } from '../apps/web/src/server/operations/status';
import type { Actor } from '../apps/web/src/server/auth/permissions';

const actor: Actor = { id: 'fixture', name: 'Recette', email: 'fixture@example.test', role: 'editor' };
const now = new Date('2026-11-12T08:00:00Z');
const success = { version: 1, day: '2026-11-12', capturedAt: '2026-11-12T06:00:00Z', verifiedAt: '2026-11-12T06:04:00Z' };
const mail = { lastAcceptedAt: null, lastFailedAt: null, failed24h: 0, uncertain: 0, waiting: 0 };

test('backup freshness follows the real UTC schedule and one-hour grace', () => {
  assert.equal(expectedBackupDay(new Date('2026-11-12T06:59:59Z')), '2026-11-11');
  assert.equal(expectedBackupDay(new Date('2026-11-12T07:00:00Z')), '2026-11-12');
  assert.equal(expectedBackupDay(new Date('2027-01-01T00:00:00Z')), '2026-12-31');
  assert.equal(inspectBackupMarkers({ success, failure: null }, now).status, 'ok');
  const old = { ...success, day: '2026-11-11', capturedAt: '2026-11-11T06:00:00Z' };
  assert.equal(inspectBackupMarkers({ success: old, failure: null }, now).status, 'late', 'Reverification does not make an old archive fresh');
  assert.equal(inspectBackupMarkers({ success: null, failure: null }, now).status, 'late');
});

test('backup failure, recovery, missing configuration and malformed markers stay distinct', () => {
  const failure = { version: 1, failedAt: '2026-11-12T06:05:00Z', stage: 'capture-distante' };
  assert.equal(inspectBackupMarkers({ success, failure }, now).status, 'error');
  assert.equal(inspectBackupMarkers({ success: { ...success, verifiedAt: '2026-11-12T06:06:00Z' }, failure }, now).status, 'ok');
  assert.equal(inspectBackupMarkers(null, now).status, 'unconfigured');
  for (const bad of [{ ...success, version: 2 }, { ...success, day: '2026-11-13' }, { ...success, verifiedAt: 'wrong' }, { ...success, verifiedAt: '2026-11-12T05:00:00Z' }, { ...success, verifiedAt: '2027-01-01T00:00:00Z' }, 'unexpected']) {
    assert.equal(inspectBackupMarkers({ success: bad, failure: null }, now).status, 'unknown');
  }
  assert.equal(inspectBackupMarkers({ success, failure: { ...failure, stage: 'secret diagnostic' } }, now).status, 'unknown');
});

test('operations require a permitted actor before touching dependencies', async () => {
  let calls = 0;
  const probe = async () => { calls++; return true; };
  await assert.rejects(() => getOperationsStatus(undefined as unknown as Actor, { probe }), { status: 403 });
  await assert.rejects(() => getOperationsStatus({ ...actor, role: 'reader' } as unknown as Actor, { probe }), { status: 403 });
  assert.equal(calls, 0);
});

test('operations report independent failures without replacing unknown mail counts by zero or leaking errors', async () => {
  const failure = async () => { throw new Error('smtp-password=private-value'); };
  const healthy = await getOperationsStatus(actor, { now, probe: async () => true, readMarkers: async () => ({ success, failure: null }), mailActivity: async () => mail });
  assert.equal(healthy.site.status, 'ok'); assert.equal(healthy.backup.status, 'ok'); assert.equal(healthy.mail.failed24h, 0);
  const partial = await getOperationsStatus(actor, { now, probe: async () => true, readMarkers: failure, mailActivity: failure });
  assert.equal(partial.site.status, 'ok'); assert.equal(partial.backup.status, 'unknown'); assert.equal(partial.mail.failed24h, null);
  assert(!JSON.stringify(partial).includes('private-value'));
  assert(!JSON.stringify(partial).includes('SMTP_PASS'));
});

test('public probe checks the canonical homepage and readiness without following redirects or counting campaigns', async t => {
  const previous = process.env.SITE_URL;
  process.env.SITE_URL = 'https://www.calas-conseil.fr';
  t.after(() => { if (previous === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = previous; });
  const calls: string[] = [];
  const fetcher = async (input: string | URL | Request, options?: RequestInit) => {
    const url = String(input); calls.push(url);
    assert.equal(options?.redirect, 'manual'); assert(options?.signal);
    return url.endsWith('/api/ready/') ? new Response('{"status":"ready"}', { headers: { 'content-type': 'application/json' } })
      : new Response('<main><h1>Calas Conseil</h1></main>', { headers: { 'content-type': 'text/html' } });
  };
  assert.equal(await probePublicSite(fetcher as typeof fetch), true);
  assert.deepEqual(calls.sort(), ['https://www.calas-conseil.fr/', 'https://www.calas-conseil.fr/api/ready/']);
  for (const result of [() => Response.redirect('https://example.test'), () => new Response('Unavailable', { status: 503 }), () => new Response('x'.repeat(1_048_577)), () => new Response('{"status":"ready"}', { headers: { 'content-type': 'text/plain' } })]) {
    assert.equal(await probePublicSite(async () => result()), false);
  }
  process.env.SITE_URL = 'https://www.calas-conseil.fr/unexpected/';
  assert.equal(await probePublicSite(fetcher as typeof fetch), false);
});

test('SMTP status rejects an invalid port without attempting authentication or sending mail', async t => {
  const values = { OUTREACH_MAIL_TRANSPORT: 'smtp', ALLOW_REAL_EMAIL: 'true', SMTP_HOST: 'smtp.example.test', SMTP_USER: 'fixture', SMTP_PASS: 'fixture', SMTP_FROM: 'contact@example.test', SMTP_PORT: '587' };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const dependencies = { now, probe: async () => true, readMarkers: async () => null, mailActivity: async () => mail };
  assert.equal((await getOperationsStatus(actor, dependencies)).mail.configured, true);
  for (const port of ['0', '65536', '587.5', 'invalid']) {
    process.env.SMTP_PORT = port;
    assert.equal((await getOperationsStatus(actor, dependencies)).mail.configured, false);
  }
});
