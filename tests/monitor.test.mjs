import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectBackup, inspectSite, readState, runCheck } from '../infra/monitor/checks.mjs';

const at = (date, time) => Date.parse(date + 'T' + time + ':00Z');
const today = '2026-11-10';
const yesterday = '2026-11-09';
const healthy = async () => ({ ok: true, reason: 'Disponible.' });
const down = async () => ({ ok: false, reason: 'HTTP 503.' });
const archived = (day, verifiedAt = day + 'T06:01:00Z') => ({
  version: 1, day, capturedAt: day + 'T06:00:00Z', verifiedAt,
});
const snapshot = async () => ({ success: archived(today), failure: null });

async function tempDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'calas-monitor-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('UTC, grâce de 06h à 07h et date réelle de capture', () => {
  const started = at(yesterday, '05:40');
  const prior = { success: archived(yesterday), failure: null };
  const check = (markers, time) => inspectBackup(markers, at(today, time), started);
  assert.equal(check(prior, '00:00').ok, true);
  assert.equal(check(prior, '06:59').ok, true);
  assert.equal(check(prior, '07:00').immediate, true);
  assert.match(check(prior, '07:00').reason, /2026-11-10 UTC/);
  prior.success.verifiedAt = today + 'T06:50:00Z';
  assert.equal(check(prior, '07:01').ok, false);
  const early = { version: 1, day: today, capturedAt: today + 'T00:15:00Z', verifiedAt: today + 'T00:16:00Z' };
  assert.equal(check({ success: early }, '07:00').ok, true);
});

test('la première archive est attendue au premier cron suivant le démarrage, grâce comprise', () => {
  const empty = { success: null, failure: null };
  const before = at(today, '05:59');
  const after = at(today, '16:00');
  assert.equal(inspectBackup(empty, at(today, '06:59'), before).ok, null);
  assert.equal(inspectBackup(empty, at(today, '07:00'), before).immediate, true);
  assert.equal(inspectBackup(empty, at('2026-11-11', '06:59'), after).ok, null);
  assert.equal(inspectBackup(empty, at('2026-11-11', '07:00'), after).ok, false);
});

test('un échec récent ouvre immédiatement un incident et une réussite postérieure le lève', () => {
  const now = at(today, '07:05');
  const failure = { version: 1, failedAt: today + 'T06:02:00Z', stage: 'connexion-base' };
  const check = (success, failureMarker) => inspectBackup({ success, failure: failureMarker }, now, now);
  assert.equal(check(null, failure).immediate, true);
  assert.match(check(archived(today), failure).reason, /connexion-base/);
  assert.equal(check(archived(today, today + 'T06:03:00Z'), failure).ok, true);
  assert.equal(check({ ...archived(today), day: yesterday }, null).ok, false);
  assert.equal(check(archived(today, '2027-01-01T00:00:00Z'), null).ok, false);
  assert.equal(check(null, { ...failure, stage: 'unknown' }).ok, false);
});

const json = () => new Response(JSON.stringify({ status: 'ready' }), { headers: { 'content-type': 'application/json' } });
const html = (text = '<main class="content"><h1>Calas Conseil</h1></main>') => new Response(text, { headers: { 'content-type': 'text/html' } });

test('la sonde teste le domaine HTTPS public, la réponse applicative et le contenu de l’accueil', async () => {
  const called = [];
  const sample = await inspectSite(async (url, options) => {
    called.push(url);
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal instanceof AbortSignal);
    return url.endsWith('/api/ready/') ? json() : html();
  });
  assert.equal(sample.ok, true);
  assert.deepEqual(called, ['https://www.calas-conseil.fr/api/ready/', 'https://www.calas-conseil.fr/']);
  for (const invalidReady of [
    () => Response.redirect('https://example.test/'),
    () => new Response('{"status":"down"}', { headers: { 'content-type': 'application/json' } }),
    () => new Response('{"status":"ready"}', { headers: { 'content-type': 'text/plain' } }),
    () => new Response('bad JSON', { headers: { 'content-type': 'application/json' } }),
    () => new Response('', { status: 503 }),
    () => new Response('x'.repeat(4097)),
  ]) {
    let probes = 0;
    const failed = await inspectSite(async () => { probes++; return invalidReady(); });
    assert.equal(failed.ok, false);
    assert.equal(probes, 1);
  }
  for (const body of ['<h1>Erreur</h1>', '<main>Maintenance</main>', 'x'.repeat(1_048_577)]) {
    const failed = await inspectSite(async url => url.endsWith('/api/ready/') ? json() : html(body));
    assert.equal(failed.ok, false);
  }
});

test('une panne de site confirmée survit au refus SMTP et au redémarrage, avec un seul rétablissement', async t => {
  const directory = await tempDirectory(t);
  const messages = [];
  const accepted = async m => { messages.push(m); };
  const run = (time, probe, send = accepted) => runCheck({ directory, now: at(today, time), probe, readMarkers: snapshot, send });
  await run('07:00', healthy);
  await run('07:05', down);
  assert.equal(messages.length, 0);
  await assert.rejects(run('07:10', down, async m => { messages.push(m); throw new Error('SMTP 451'); }), /451/);
  assert.equal((await readState(directory)).pending.length, 1);
  await run('07:15', down);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].messageId, messages[1].messageId);
  assert.match(messages[1].subject, /Site web en alerte/);
  await run('07:20', down);
  assert.equal(messages.length, 2);
  await run('07:25', healthy);
  assert.match(messages[2].subject, /Site web rétabli/);
  assert.notEqual(messages[1].messageId, messages[2].messageId);
  await run('07:30', healthy);
  assert.equal(messages.length, 3);
  assert.equal((await readState(directory)).pending.length, 0);
});

test('le moniteur alerte même si le stockage des marqueurs est inaccessible', async t => {
  const directory = await tempDirectory(t);
  const messages = [];
  const missingStorage = async () => { throw new Error('AccessDenied'); };
  const run = (time, readMarkers) => runCheck({
    directory, now: at(today, time), readMarkers, probe: healthy, send: async m => { messages.push(m); },
  });
  await run('07:00', missingStorage);
  await run('07:05', missingStorage);
  await run('07:10', missingStorage);
  await run('07:15', snapshot);
  assert.equal(messages.length, 2);
  assert.match(messages[0].text, /stockage des marqueurs/);
  assert.match(messages[1].subject, /Sauvegarde rétablie/);
});

test('l’exercice produit un mail groupé, seulement après acceptation, sans ouvrir d’incident', async t => {
  const directory = await tempDirectory(t);
  const messages = [];
  const run = (send, request = 'calas-test-1') => runCheck({
    directory, now: at(today, '07:15'), readMarkers: snapshot, probe: healthy, send, testRequest: request,
  });
  await assert.rejects(run(async m => { messages.push(m); throw new Error('SMTP 451'); }));
  assert.equal((await readState(directory)).acceptedTests.length, 0);
  const accepted = async m => { messages.push(m); };
  assert.equal((await run(accepted)).testEmail, 'accepted');
  assert.equal((await run(accepted)).testEmail, 'already-accepted');
  assert.equal(messages.length, 2);
  assert.equal(messages[0].messageId, messages[1].messageId);
  assert.equal(messages[1].subject, 'Test Calas – alertes de panne et de sauvegarde');
  assert.match(messages[1].text, /simulés/);
  assert.match(messages[1].text, /Site web/);
  assert.match(messages[1].text, /Sauvegarde/);
  const state = await readState(directory);
  assert.equal(state.pending.length, 0);
  assert.equal(state.signals.site.openedAt, null);
  assert.equal(state.signals.backup.openedAt, null);
  assert.equal(state.acceptedTests.length, 1);
});

test('un état corrompu remonte une erreur au lieu de renvoyer de vieilles alertes', async t => {
  const directory = await tempDirectory(t);
  await writeFile(join(directory, 'state.json'), '{"version":1}');
  await assert.rejects(readState(directory, 0), /invalide/);
});
