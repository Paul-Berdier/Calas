import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Boundary unit tests: only Better Auth's lookup and PostgreSQL are substituted.
// Permissions, preview selection, routes and cache policy are production code.
// Real passwords, TOTP, cookies and revocation: scripts/auth-security-check.mjs.
const result = await build({
  absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
  stdin: { resolveDir: root, contents: `
    export * as preview from './apps/web/src/lib/cms/preview.ts';
    export * as client from './apps/web/src/lib/cms/client.ts';
    export * as enable from './apps/web/src/pages/api/preview/enable.ts';
    export * as disable from './apps/web/src/pages/api/preview/disable.ts';
  ` },
  plugins: [{ name: 'infrastructure-boundaries', setup(builder) {
    builder.onResolve({ filter: /^\.\/index$/ }, args => /server[/\\]auth[/\\]permissions\.ts$/.test(args.importer) ? { path: 'session', namespace: 'fixture' } : undefined);
    builder.onResolve({ filter: /server\/content\/repository$/ }, () => ({ path: 'repository', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'js', contents: path === 'session' ? `
      export function getAuth() { return { api: { async getSession(input) {
        globalThis.__calasPreviewBoundary.sessionCalls.push(input);
        return structuredClone(globalThis.__calasPreviewBoundary.session);
      } } }; }
    ` : `
      export async function readSiteContent(options) {
        const state=globalThis.__calasPreviewBoundary;
        state.contentCalls.push(options);
        if(state.failure) throw new Error('private SQL diagnostic must never leak');
        return {settings:{brand:'Calas Conseil'},home:{title:options.preview?'Private draft title':'Published title'},pages:[],people:[],articles:[]};
      }
    ` }));
  } }],
});
const { preview, client, enable, disable } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const keys = ['BETTER_AUTH_SECRET', 'DATABASE_URL', 'CONTENT_MODE'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const verified = () => ({ user: { id: 'editor-test', name: 'Équipe de recette', email: 'editor@example.test', role: 'editor', disabled: false, emailVerified: true, twoFactorEnabled: true }, session: { mfaVerified: true } });
let state;
beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = 'unit-test-only-not-a-real-secret-0123456789';
  process.env.DATABASE_URL = 'postgresql://unit-test-only/never-connected';
  process.env.CONTENT_MODE = 'database';
  state = globalThis.__calasPreviewBoundary = { session: null, sessionCalls: [], contentCalls: [], failure: false };
});
afterEach(() => {
  for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  delete globalThis.__calasPreviewBoundary;
});
function context(path = '/?preview=1', headers = {}) {
  const url = new URL(path, 'https://preview.example');
  return { url, request: new Request(url, { headers }), locals: {}, response: { headers: new Headers() } };
}

test('la demande de preview ne remplace jamais une session authentifiée', async () => {
  const request = context('/?preview=1', { Cookie: 'better-auth.session_token=forged; calas_preview=drafts' });
  assert.equal(await preview.isPreview(request), false);
  assert.equal(state.sessionCalls.length, 1);
  assert.equal(state.sessionCalls[0].query.disableCookieCache, true);
  assert.equal(state.sessionCalls[0].headers.get('cookie'), request.request.headers.get('cookie'));
  assert.equal((await client.getSiteContent(request)).home.title, 'Published title');
  assert.deepEqual(state.contentCalls, [{ preview: false }]);
});

test('seul preview=1 ouvre le brouillon à un rôle autorisé avec MFA vérifiée', async () => {
  for (const role of ['editor', 'administrator']) {
    state.session = verified(); state.session.user.role = role;
    assert.equal(await preview.isPreview(context()), true);
    for (const query of ['', '?preview=true', '?preview=drafts', '?preview=published', '?preview=raw']) {
      const calls = state.sessionCalls.length;
      assert.equal(await preview.isPreview(context(`/${query}`)), false);
      assert.equal(state.sessionCalls.length, calls);
    }
  }
});

test('compte désactivé, adresse non vérifiée, MFA incomplète et rôle inconnu restent publics', async () => {
  const variants = [
    { user: { disabled: true } }, { user: { emailVerified: false } },
    { user: { twoFactorEnabled: false } }, { session: { mfaVerified: false } },
    { user: { role: 'owner-from-cookie' } },
  ];
  for (const override of variants) {
    const base = verified();
    state.session = { user: { ...base.user, ...override.user }, session: { ...base.session, ...override.session } };
    assert.equal(await preview.isPreview(context()), false);
    const response = await enable.GET(context('/api/preview/enable/?path=/diagnostic-rps/'));
    assert.ok([401, 403].includes(response.status));
    assert.equal(response.headers.get('set-cookie'), null);
  }
});

test('une session révoquée ou expirée est relue sans cache à la requête suivante', async () => {
  state.session = verified();
  assert.equal(await preview.isPreview(context()), true);
  // Better Auth returns null after expiry/revocation; the caller must not retain its earlier decision.
  state.session = null;
  assert.equal(await preview.isPreview(context()), false);
  assert.equal(state.sessionCalls.length, 2);
  assert.ok(state.sessionCalls.every(call => call.query.disableCookieCache === true));
});

test('les réponses avec brouillons sont privées, sans cache et non indexables', async () => {
  state.session = verified();
  const request = context();
  assert.equal((await client.getSiteContent(request)).home.title, 'Private draft title');
  assert.deepEqual(state.contentCalls, [{ preview: true }]);
  assert.match(request.response.headers.get('cache-control'), /private.*no-store/);
  assert.match(request.response.headers.get('x-robots-tag'), /noindex/);
  assert.equal(request.response.headers.get('vary'), 'Cookie');
  assert.equal(request.response.headers.get('referrer-policy'), 'no-referrer');
});

test('publishedOnly ignore la session privée pour les sorties publiques comme le sitemap', async () => {
  state.session = verified();
  const request = context();
  assert.equal((await client.getSiteContent(request, { publishedOnly: true })).home.title, 'Published title');
  assert.deepEqual(state.contentCalls, [{ preview: false }]);
  assert.equal(state.sessionCalls.length, 0);
  assert.equal(request.response.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
});

test('activation et sortie conservent la session Better Auth sans créer un second cookie', async () => {
  state.session = verified();
  const response = await enable.GET(context('/api/preview/enable/?path=%2Fdiagnostic-rps%2F%3Fobjet%3Ddiagnostic%23etapes'));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/diagnostic-rps/?objet=diagnostic&preview=1#etapes');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  const exit = await disable.GET(context('/api/preview/disable/?path=%2Fdiagnostic-rps%2F%3Fpreview%3D1%23etapes'));
  assert.equal(exit.headers.get('location'), '/diagnostic-rps/#etapes');
  assert.equal(exit.headers.get('set-cookie'), null);
});

test('activation anonyme refusée et redirections limitées aux pages du même site', async () => {
  const response = await enable.GET(context('/api/preview/enable/?preview=1&secret=invente'));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('set-cookie'), null);
  const origin = 'https://preview.example';
  for (const target of ['https://attacker.example', '//attacker.example/', '/\\attacker.example/', '/api/admin/content/', '/admin/articles/', '/admin', '/api', '/%61dmin/', '/%2561pi/', '/%2f/attacker.example', '/%5cattacker.example/', '/contact/\r\nLocation: https://attacker.example']) {
    assert.equal(preview.safePreviewRedirect(target, origin), '/');
  }
  assert.equal(preview.safePreviewRedirect('/contact/?objet=equipes&preview=1#formulaire', origin), '/contact/?objet=equipes#formulaire');
});

test('une panne PostgreSQL ne retourne jamais les contenus de démonstration', async () => {
  state.failure = true;
  const request = context('/');
  await assert.rejects(() => client.getSiteContent(request), error => error instanceof client.ContentUnavailableError && !error.message.includes('SQL'));
  assert.match(request.response.headers.get('cache-control'), /private.*no-store/);
  assert.deepEqual(state.contentCalls, [{ preview: false }]);
});

