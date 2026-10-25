import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
async function load(entry, plugins = []) {
  const result = await build({ absWorkingDir: root, entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm', plugins, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const preview = await load('apps/web/src/lib/cms/preview.ts');
// Mock only the remote Sanity secret validation and its client: these tests
// exercise our real route/session code, without contacting a Sanity project.
const route = await load('apps/web/src/pages/api/preview/enable.ts', [{
  name: 'local-preview-boundary',
  setup(builder) {
    builder.onResolve({ filter: /^@sanity\/preview-url-secret$/ }, () => ({ path: 'secret', namespace: 'mock' }));
    builder.onResolve({ filter: /lib\/cms\/client$/ }, () => ({ path: 'client', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: path === 'secret'
      ? `export async function validatePreviewUrl(client, address) { const url = new URL(address); return { isValid: url.searchParams.get('sanity-preview-secret') === 'local-valid-secret', redirectTo: '/diagnostic-rps/', studioPreviewPerspective: url.searchParams.get('sanity-preview-perspective') ?? undefined }; }`
      : `export function createServerClient() { return { withConfig() { return {}; } }; }`, loader: 'js' }));
  },
}]);

const keys = ['PREVIEW_SESSION_SECRET', 'SANITY_API_READ_TOKEN', 'PUBLIC_SANITY_PROJECT_ID', 'PUBLIC_SANITY_DATASET', 'CONTENT_MODE'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
beforeEach(() => {
  process.env.PREVIEW_SESSION_SECRET = 'local-only-preview-secret-0123456789abcdef';
  process.env.SANITY_API_READ_TOKEN = 'local-placeholder-not-a-token';
  process.env.PUBLIC_SANITY_PROJECT_ID = 'calastest';
  process.env.PUBLIC_SANITY_DATASET = 'staging';
  process.env.CONTENT_MODE = 'sanity';
});
afterEach(() => {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
});
const cookies = value => ({ get: () => value ? { value } : undefined });
function replaceClaim(session, perspective, resign = false) {
  const [body, signature] = session.split('.');
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
  const payload = Buffer.from(JSON.stringify({ ...claims, perspective })).toString('base64url');
  const hmac = resign ? createHmac('sha256', process.env.PREVIEW_SESSION_SECRET).update(payload).digest('base64url') : signature;
  return `${payload}.${hmac}`;
}

test('brouillons et publié sont deux perspectives privées signées distinctes', () => {
  for (const perspective of ['drafts', 'published']) {
    const value = preview.createPreviewSession(Date.now(), perspective);
    assert.equal(preview.verifyPreviewSession(value), true);
    assert.equal(preview.getPreviewPerspective(cookies(value)), perspective);
    assert.equal(preview.isPreview(cookies(value)), true);
  }
  assert.equal(preview.getPreviewPerspective(cookies(preview.createPreviewSession())), 'drafts');
  assert.equal(preview.getPreviewPerspective(cookies()), null);
});

test('modifier la perspective du cookie ne permet jamais de passer aux brouillons', () => {
  const published = preview.createPreviewSession(Date.now(), 'published');
  const forged = replaceClaim(published, 'drafts');
  assert.equal(preview.verifyPreviewSession(forged), false);
  assert.equal(preview.getPreviewPerspective(cookies(forged)), null);
});

test('raw et les Releases sont refusés, même avec une signature valide', () => {
  const value = preview.createPreviewSession();
  for (const unsupported of ['raw', 'release-example', ['drafts', 'published']]) {
    assert.throws(() => preview.createPreviewSession(Date.now(), unsupported));
    assert.equal(preview.verifyPreviewSession(replaceClaim(value, unsupported, true)), false);
  }
});

test('la session publié expire et reste liée au projet, au dataset et au jeton', () => {
  const now = Date.now();
  const value = preview.createPreviewSession(now, 'published');
  assert.equal(preview.verifyPreviewSession(value, now + preview.PREVIEW_TTL * 1000), false);
  process.env.PUBLIC_SANITY_DATASET = 'elsewhere';
  assert.equal(preview.verifyPreviewSession(value), false);
  process.env.PUBLIC_SANITY_DATASET = 'staging';
  process.env.PUBLIC_SANITY_PROJECT_ID = 'elsewhere';
  assert.equal(preview.verifyPreviewSession(value), false);
  process.env.PUBLIC_SANITY_PROJECT_ID = 'calastest';
  process.env.SANITY_API_READ_TOKEN = '';
  assert.equal(preview.verifyPreviewSession(value), false);
});

async function activate(perspective, secret = 'local-valid-secret') {
  const url = new URL('https://preview.example/api/preview/enable/');
  url.searchParams.set('sanity-preview-secret', secret);
  if (perspective) url.searchParams.set('sanity-preview-perspective', perspective);
  const stored = [];
  const request = new Request(url, { headers: { 'sec-fetch-dest': 'iframe', 'sec-fetch-site': 'cross-site' } });
  const response = await route.GET({ url, request, cookies: { set: (...args) => stored.push(args) } });
  return { response, stored };
}

test('après validation distante simulée, le routeur signe publié et conserve les protections iframe', async () => {
  const { response, stored } = await activate('published');
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), '/diagnostic-rps/');
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
  assert.equal(stored.length, 1);
  assert.equal(preview.getPreviewPerspective(cookies(stored[0][1])), 'published');
  assert.deepEqual(stored[0][2], { path: '/', httpOnly: true, secure: true, sameSite: 'none', partitioned: true, maxAge: preview.PREVIEW_TTL });
});

test('la route ne crée aucune session pour une perspective non prise en charge ou un secret refusé', async () => {
  for (const [perspective, secret, status] of [['raw', 'local-valid-secret', 400], ['release-example', 'local-valid-secret', 400], ['published', 'invalid', 401]]) {
    const result = await activate(perspective, secret);
    assert.equal(result.response.status, status);
    assert.equal(result.stored.length, 0);
  }
});
