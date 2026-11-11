/** Real isolated PostgreSQL + Better Auth + HTTP + browser recipe. No external email. */
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, request } from '@playwright/test';
import { getDb, getPool, closeDatabase } from '../apps/web/src/server/db';
import { migrateDatabase } from '../apps/web/src/server/db/migrate';
import { createAuth } from '../apps/web/src/server/auth';
import { seedDocuments } from '../apps/web/src/server/content/repository';
import { prepareSeedPlan } from '../apps/web/src/server/content/seed-plan';
import { demoContent } from '../apps/web/src/lib/cms/demo';
import { unseal } from '../apps/web/src/server/outreach/tokens';

const root = fileURLToPath(new URL('../', import.meta.url));
loadEnvFile(resolve(root, 'apps/web/.env'));
const original = process.env.DATABASE_URL!;
assert(['localhost', '127.0.0.1'].includes(new URL(original).hostname), 'Local database only');
const base = 'http://localhost:4348';
const database = `calas_http_test_${randomUUID().replaceAll('-', '')}`;
const password = randomBytes(28).toString('base64url');
const email = `http-${randomUUID()}@example.test`;
const report: string[] = [];
let server: ReturnType<typeof spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const clients: Awaited<ReturnType<typeof request.newContext>>[] = [];
await getPool().query(`CREATE DATABASE "${database}"`);
await closeDatabase();
const isolated = new URL(original); isolated.pathname = '/' + database;
Object.assign(process.env, {
  DATABASE_URL: isolated.href, SITE_ENV: 'staging', CONTENT_MODE: 'database', SITE_URL: base, BETTER_AUTH_URL: base,
  HOST: '127.0.0.1', PORT: '4348', AUTH_MAIL_TRANSPORT: 'local', AUTH_SMTP_HOST: '127.0.0.1', AUTH_SMTP_PORT: '11025',
  AUTH_SMTP_FROM: 'Calas local <cms@example.test>', ALLOW_REAL_EMAIL: 'false', OUTREACH_MAIL_TRANSPORT: 'simulation', OUTREACH_RUNNER_ENABLED: 'true',
  OUTREACH_LINK_SECRET: randomBytes(32).toString('hex'), BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
});
const pass = (name: string) => { report.push(name); console.log(name); };
try {
  await migrateDatabase(resolve(root, 'drizzle'));
  await seedDocuments(prepareSeedPlan(demoContent).entries, { publish: true });
  const signup = await createAuth(getDb(), true).api.signUpEmail({ body: { name: 'Recette HTTP', email, password } });
  await getPool().query("UPDATE auth_user SET role='administrator' WHERE id=$1", [signup.user.id]);
  process.env.AUTH_TEST_PASSWORD_ONLY_USER_ID = signup.user.id;
  server = spawn(process.execPath, ['dist/start.mjs'], { cwd: resolve(root, 'apps/web'), env: process.env, stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true });
  let ready = false;
  for (let n = 0; n < 80; n++) {
    try { if ((await fetch(base + '/api/health/')).ok) { ready = true; break; } } catch { /* wait for the local process */ }
    await new Promise(r => setTimeout(r, 250));
  }
  assert(ready, 'Standalone process must be built and able to start');
  const admin = await request.newContext({ baseURL: base }); clients.push(admin);
  const anon = await request.newContext({ baseURL: base }); clients.push(anon);
  const call = (path: string, data?: unknown, origin = base) => admin.fetch(path, { method: data === undefined ? 'GET' : 'POST', data, headers: { Origin: origin } });
  async function ok(path: string, data?: unknown) { const response = await call(path, data); assert(response.ok(), `${path}: HTTP ${response.status()}`); return response.json(); }
  assert.equal((await anon.get('/api/admin/outreach/overview/')).status(), 401);
  assert.equal((await anon.get('/api/admin/integrations/tokens/')).status(), 401);
  const inbox = await (await fetch('http://127.0.0.1:18025/api/v1/messages')).json();
  const mail = inbox.messages.find((item: { To?: { Address: string }[] }) => item.To?.some(to => to.Address === email));
  assert(mail, 'Local verification email');
  const text = (await (await fetch(`http://127.0.0.1:18025/api/v1/message/${mail.ID}`)).json()).Text as string;
  const link = text.match(/https?:\/\/[^\s]+/)?.[0]; assert(link && new URL(link).origin === base);
  assert((await admin.get(link)).ok());
  await ok('/api/auth/sign-in/email/', { email, password });
  assert.equal((await getPool().query('SELECT mfa_verified FROM auth_session WHERE user_id=$1', [signup.user.id])).rows[0].mfa_verified, false);
  pass('Vraie connexion et vérification via Mailpit ; aucun TOTP artificiel');
  assert.equal((await call('/api/admin/outreach/contacts/', {}, 'https://outside.example')).status(), 403);
  const prospect = await ok('/api/admin/outreach/contacts/', { email: 'recipient@example.test', name: 'Contact de recette', company: 'Entreprise locale', jobTitle: 'Direction', source: 'Recette locale sans diffusion', sourceDate: new Date().toISOString().slice(0, 10), informationConfirmed: true });
  const campaign = await ok('/api/admin/outreach/campaigns/', { title: 'Recette HTTP', subject: 'Découvrir Calas Conseil', body: 'Présentation professionnelle de recette sans envoi externe.', targetPath: '/diagnostic-rps/' });
  const queued = await ok(`/api/admin/outreach/campaigns/${campaign.id}/send/`, { version: campaign.version, contactIds: [prospect.id], confirmation: true });
  assert.equal(queued.queued, 1); assert.equal(queued.simulation, true);
  let simulated = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if ((await ok('/api/admin/outreach/overview/')).stats.simulated === 1) { simulated = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert(simulated, 'Integrated runner processes the queue without a separate service');
  pass('API protégée et campagne traitée automatiquement en simulation dans le service web');
  const follow = await anon.get(campaign.linkPath, { maxRedirects: 0 });
  assert.equal(follow.status(), 302); assert.match(follow.headers().location!, /^\/diagnostic-rps\/\?campagne=c_/);
  assert.equal((await ok('/api/admin/outreach/overview/')).stats.visits, 0);
  assert.match(follow.headers()['x-robots-tag']!, /noindex/);
  browser = await chromium.launch();
  const publicContext = await browser.newContext(); const page = await publicContext.newPage();
  await page.goto(base + campaign.linkPath); await page.waitForTimeout(2000);
  let overview = await ok('/api/admin/outreach/overview/'); assert.equal(overview.stats.visits, 1); assert.equal(overview.stats.arrivals, 1);
  const nextHref = await page.locator('a[href*="/notre-approche/?campagne="]').first().getAttribute('href'); assert(nextHref);
  await page.goto(nextHref); await page.waitForTimeout(2000);
  overview = await ok('/api/admin/outreach/overview/'); assert.equal(overview.stats.visits, 2); assert.equal(overview.stats.arrivals, 1);
  assert.equal((await publicContext.cookies()).length, 0);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await page.getByRole('button', { name: 'Arrêter cette mesure' }).click(); assert(!page.url().includes('campagne='));
  await page.reload(); await page.waitForTimeout(1800); assert.equal((await ok('/api/admin/outreach/overview/')).stats.visits, 2);
  const noJs = await browser.newContext({ javaScriptEnabled: false }); const plain = await noJs.newPage(); await plain.goto(base + campaign.linkPath); assert.equal(await plain.locator('h1').count(), 1); await noJs.close();
  pass('Lien direct, arrivées/consultations distinctes, arrêt, zéro stockage navigateur, navigation sans JavaScript');
  const delivery = (await getPool().query('SELECT unsubscribe_encrypted FROM outreach_deliveries WHERE campaign_id=$1', [campaign.id])).rows[0];
  const unsubPath = '/r/' + unseal(delivery.unsubscribe_encrypted) + '/';
  await page.goto(base + unsubPath); assert.equal((await getPool().query('SELECT status FROM outreach_prospects WHERE id=$1', [prospect.id])).rows[0].status, 'active');
  assert.equal((await anon.post(unsubPath, { form: { action: 'unsubscribe' }, headers: { Origin: 'https://outside.example' } })).status(), 403);
  const [submission] = await Promise.all([page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/r/u_')), page.getByRole('button', { name: 'Me désinscrire' }).click()]);
  assert.equal(submission.status(), 200, 'Native unsubscribe POST must preserve same-origin authorization');
  await page.getByRole('heading', { name: 'Votre désinscription est enregistrée.' }).waitFor();
  assert.equal((await getPool().query('SELECT status FROM outreach_prospects WHERE id=$1', [prospect.id])).rows[0].status, 'suppressed');
  pass('Désinscription explicite, GET sans effet et POST externe refusé');
  const token = await ok('/api/admin/integrations/tokens/', { name: 'Recette HTTP', scopes: ['read', 'draft', 'publish', 'outreach', 'send', 'users'] });
  const machine = await request.newContext({ baseURL: base, extraHTTPHeaders: { Authorization: `Bearer ${token.token}` } }); clients.push(machine);
  const descriptor = await machine.get('/api/agent/tools/'); assert.equal(descriptor.status(), 200);
  assert((await descriptor.json()).tools.some((tool: { name: string }) => tool.name === 'calas_queue_campaign'));
  const identity = await machine.post('/api/agent/tools/', { data: { name: 'calas_identity', arguments: {} } }); assert.equal(identity.status(), 200);
  assert.equal((await machine.get('/api/agent/tools/', { headers: { Origin: base } })).status(), 403);
  await ok(`/api/admin/integrations/tokens/${token.item.id}/revoke/`, {});
  assert.equal((await machine.get('/api/agent/tools/')).status(), 401);
  pass('Accès assistant réel, liste outils, isolation bearer/session et révocation immédiate');

  const metadata = await anon.get('/.well-known/oauth-authorization-server'); assert.equal(metadata.status(), 200);
  const resource = await anon.get('/.well-known/oauth-protected-resource/mcp'); assert.equal(resource.status(), 200);
  assert.equal((await resource.json()).resource, base + '/mcp/');
  const registration = await anon.post('/oauth/register/', { data: { client_name: 'Application IA de recette', redirect_uris: ['https://client.example.test/callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] } });
  assert.equal(registration.status(), 201);
  const oauthClient = await registration.json();
  const verifier = randomBytes(48).toString('base64url'), state = randomBytes(24).toString('base64url');
  const authorization = new URL(base + '/oauth/authorize/');
  authorization.search = new URLSearchParams({ response_type: 'code', client_id: oauthClient.client_id, redirect_uri: 'https://client.example.test/callback', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', scope: 'read draft publish outreach send users', resource: base + '/mcp/', state }).toString();
  const consentContext = await browser.newContext({ storageState: await admin.storageState() });
  const consentPage = await consentContext.newPage();
  await consentPage.route('https://client.example.test/callback**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Application de recette reconnectée</h1>' }));
  await consentPage.goto(authorization.href);
  await consentPage.getByRole('button', { name: 'Autoriser la connexion' }).waitFor();
  assert((await consentPage.textContent('body'))?.includes('client.example.test'));
  await Promise.all([consentPage.waitForURL('https://client.example.test/callback**'), consentPage.getByRole('button', { name: 'Autoriser la connexion' }).click()]);
  const returned = new URL(consentPage.url()); assert.equal(returned.searchParams.get('state'), state);
  const code = returned.searchParams.get('code'); assert(code);
  const exchanged = await anon.post('/oauth/token/', { form: { grant_type: 'authorization_code', client_id: oauthClient.client_id, code, code_verifier: verifier, redirect_uri: 'https://client.example.test/callback', resource: base + '/mcp/' } });
  assert.equal(exchanged.status(), 200); const oauth = await exchanged.json(); assert(oauth.access_token && oauth.refresh_token);
  const mcpRequire = createRequire(new URL('../apps/mcp/package.json', import.meta.url));
  const { Client, StreamableHTTPClientTransport } = await import(pathToFileURL(mcpRequire.resolve('@modelcontextprotocol/client')).href);
  const remote = new Client({ name: 'calas-http-recipe', version: '1.0.0' });
  try {
    await remote.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp/'), { requestInit: { headers: { Authorization: `Bearer ${oauth.access_token}` } } }));
    assert((await remote.listTools()).tools.some((tool: { name: string }) => tool.name === 'calas_queue_campaign'));
    const identity = await remote.callTool({ name: 'calas_identity', arguments: {} }); assert.equal(JSON.parse(identity.content[0].text).role, 'administrator');
  } finally { await remote.close(); }
  const refreshed = await anon.post('/oauth/token/', { form: { grant_type: 'refresh_token', client_id: oauthClient.client_id, refresh_token: oauth.refresh_token, resource: base + '/mcp/' } });
  assert.equal(refreshed.status(), 200); const rotation = await refreshed.json(); assert.notEqual(rotation.refresh_token, oauth.refresh_token);
  assert.equal((await anon.post('/oauth/revoke/', { form: { token: rotation.refresh_token, client_id: oauthClient.client_id } })).status(), 200);
  const rejected = await anon.post('/mcp/', { headers: { Authorization: `Bearer ${rotation.access_token}`, Accept: 'application/json, text/event-stream' }, data: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
  assert.equal(rejected.status(), 401);
  await consentContext.close();
  pass('OAuth PKCE réel, consentement navigateur, SDK MCP HTTP, rotation puis révocation');
  await mkdir(resolve(root, 'artifacts/outreach'), { recursive: true });
  await writeFile(resolve(root, 'artifacts/outreach/http.json'), JSON.stringify({ passed: report, externalEmails: 0 }, null, 2));
} finally {
  await Promise.all(clients.map(client => client.dispose()));
  await browser?.close();
  if (server && server.exitCode === null) { server.kill(); await new Promise<void>(r => { server!.once('exit', () => r()); setTimeout(r, 5000); }); }
  await closeDatabase(); process.env.DATABASE_URL = original;
  await getPool().query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await closeDatabase();
}
