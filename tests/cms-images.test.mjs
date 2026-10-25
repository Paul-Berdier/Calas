import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Bundle the real TypeScript helper for a local, network-free Node test.
const built = await build({
  entryPoints: [fileURLToPath(new URL('../apps/web/src/lib/cms/images.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
});
const { imageUrl } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const keys = ['PUBLIC_SANITY_PROJECT_ID', 'PUBLIC_SANITY_DATASET'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
afterEach(() => {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
});
const image = {
  alt: 'Image de recette locale',
  asset: { _ref: `image-${'a'.repeat(40)}-1200x800-jpg` },
  crop: { left: .1, right: .1, top: .1, bottom: .1 },
  hotspot: { x: .75, y: .5, width: .1, height: .2 },
};
function configure() {
  process.env.PUBLIC_SANITY_PROJECT_ID = 'calastest';
  process.env.PUBLIC_SANITY_DATASET = 'staging';
}

test('un format carré conserve le crop et cadre vers le hotspot de droite', () => {
  configure();
  const url = new URL(imageUrl(image, 300, 300));
  assert.equal(url.origin, 'https://cdn.sanity.io');
  assert.equal(url.searchParams.get('rect'), '440,80,640,640');
  assert.equal(url.searchParams.get('w'), '300');
  assert.equal(url.searchParams.get('h'), '300');
  assert.equal(url.searchParams.get('fit'), 'crop');
  const left = new URL(imageUrl({ ...image, hotspot: { ...image.hotspot, x: .25 } }, 300, 300));
  assert.equal(left.searchParams.get('rect'), '120,80,640,640');
});

test('sans hauteur, le cadrage éditorial est conservé sans imposer de ratio', () => {
  configure();
  const url = new URL(imageUrl(image, 600));
  assert.equal(url.searchParams.get('rect'), '120,80,960,640');
  assert.equal(url.searchParams.get('fit'), 'max');
  assert.equal(url.searchParams.has('h'), false);
});

test('sans asset ou configuration CMS, aucune URL publique factice n’est fabriquée', () => {
  configure();
  assert.equal(imageUrl({ alt: 'Absente' }, 600), undefined);
  process.env.PUBLIC_SANITY_PROJECT_ID = '';
  assert.equal(imageUrl(image, 600, 400), undefined);
});
