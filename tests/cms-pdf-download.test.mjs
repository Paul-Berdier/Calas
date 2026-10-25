import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const built = await build({
  entryPoints: [fileURLToPath(new URL('../apps/web/src/lib/cms/files.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
});
const { pdfDownload, formatFileSize } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const keys = ['PUBLIC_SANITY_PROJECT_ID', 'PUBLIC_SANITY_DATASET'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
beforeEach(() => {
  process.env.PUBLIC_SANITY_PROJECT_ID = 'calastest';
  process.env.PUBLIC_SANITY_DATASET = 'staging';
});
afterEach(() => {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
});
const hash = 'a'.repeat(40);
const file = { asset: {
  _id: `file-${hash}-pdf`,
  url: `https://cdn.sanity.io/files/calastest/staging/${hash}.pdf`,
  originalFilename: 'Le lien au travail.pdf',
  size: 2_400_000,
  mimeType: 'application/pdf',
} };

test('le PDF Sanity reçoit le paramètre CDN de téléchargement et un poids français lisible', () => {
  const result = pdfDownload(file);
  assert.equal(result.filename, 'Le lien au travail.pdf');
  assert.equal(result.size, '2,4 Mo');
  const url = new URL(result.url);
  assert.equal(url.origin, 'https://cdn.sanity.io');
  assert.equal(url.searchParams.get('dl'), 'Le lien au travail.pdf');
  assert.deepEqual([...url.searchParams.keys()], ['dl']);
});

test('refuse les hôtes, protocoles, identifiants et chemins autres que cet asset Sanity', () => {
  for (const url of [
    `http://cdn.sanity.io/files/calastest/staging/${hash}.pdf`,
    `https://cdn.sanity.io.attacker.example/files/calastest/staging/${hash}.pdf`,
    `https://name:password@cdn.sanity.io/files/calastest/staging/${hash}.pdf`,
    `https://cdn.sanity.io/files/another/staging/${hash}.pdf`,
    `https://cdn.sanity.io/files/calastest/production/${hash}.pdf`,
    `https://cdn.sanity.io/files/calastest/staging/${'b'.repeat(40)}.pdf`,
    'javascript:alert(1)',
    '/document.pdf',
  ]) assert.equal(pdfDownload({ asset: { ...file.asset, url } }), null, url);
});

test('ne présente pas un asset non PDF, incomplet ou sans configuration CMS', () => {
  assert.equal(pdfDownload(undefined), null);
  assert.equal(pdfDownload({}), null);
  assert.equal(pdfDownload({ asset: { ...file.asset, mimeType: 'text/html' } }), null);
  assert.equal(pdfDownload({ asset: { ...file.asset, _id: 'image-example-pdf' } }), null);
  process.env.PUBLIC_SANITY_PROJECT_ID = '';
  assert.equal(pdfDownload(file), null);
});

test('élimine les paramètres parasites et assainit le nom de téléchargement', () => {
  const result = pdfDownload({ asset: { ...file.asset, url: `${file.asset.url}?dl=autre.exe&redirect=https://elsewhere.example/#fragment`, originalFilename: '../lettre\n.pdf' } });
  const url = new URL(result.url);
  assert.equal(url.searchParams.get('dl'), '..-lettre-.pdf');
  assert.deepEqual([...url.searchParams.keys()], ['dl']);
  assert.equal(url.hash, '');
  const unnamed = pdfDownload({ asset: { ...file.asset, originalFilename: undefined } });
  assert.equal(unnamed.filename, 'article-original.pdf');
});

test('le poids utilise les unités décimales et n’invente pas une taille inconnue', () => {
  assert.equal(formatFileSize(42), '42 o');
  assert.equal(formatFileSize(125_000), '125 ko');
  assert.equal(formatFileSize(20_000_000), '20 Mo');
  for (const size of [undefined, 0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(formatFileSize(size), null);
  assert.equal(pdfDownload({ asset: { ...file.asset, size: undefined } }).size, null);
});
