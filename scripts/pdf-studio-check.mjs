import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const studio = resolve(root, 'apps/studio');
const studioRequire = createRequire(resolve(studio, 'package.json'));
const sanityRequire = createRequire(studioRequire.resolve('sanity/package.json'));
const { createServer } = await import(pathToFileURL(sanityRequire.resolve('vite')).href);
const folder = resolve(studio, '.cache/pdf-studio-check');
const artifacts = resolve(root, 'artifacts/pdf-import');
await mkdir(folder, { recursive: true });
await mkdir(artifacts, { recursive: true });

await writeFile(resolve(folder, 'index.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recette locale, accès Sanity simulés</title><style>body{margin:0;background:#fff;color:#14213a;font:16px/1.5 Arial,sans-serif}.local-banner{padding:12px 24px;background:#14213a;color:white;text-align:center;font-weight:600}button,input,textarea{font:inherit}</style></head><body><div class="local-banner">Recette locale, accès Sanity simulés</div><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>`);
await writeFile(resolve(folder, 'main.tsx'), `import {createRoot} from 'react-dom/client'; import {PdfImportTool} from '/components/PdfImportTool.tsx'; createRoot(document.getElementById('root')!).render(<PdfImportTool/>);`);
await writeFile(resolve(folder, 'mock-sanity.ts'), `
const state = window.__pdfMock = {uploads:[], calls:[], documents:{}, intents:[], releaseUpload:null, releaseFailure:null};
const client = {
  assets: {async upload(kind, file, options) {
    state.uploads.push({kind, name:file.name, size:file.size, options});
    await new Promise(resolve => state.releaseUpload=resolve);
    return {_id:'file-${'a'.repeat(40)}-pdf'};
  }},
  async createIfNotExists(document) {
    const snapshot=structuredClone(document);
    state.calls.push(snapshot);
    state.documents[document._id] ??= snapshot;
    if(state.calls.length===1) {
      await new Promise(resolve=>state.releaseFailure=resolve);
      throw new Error('Simulation: document créé, réponse réseau perdue');
    }
    return structuredClone(state.documents[document._id]);
  },
};
export function useClient(){return client;}
`);
await writeFile(resolve(folder, 'mock-router.ts'), `const router={navigateIntent(intent,params){window.__pdfMock.intents.push({intent,params});}};export function useRouter(){return router;}`);

const server = await createServer({
  configFile: false, root: studio, publicDir: resolve(studio, 'public'),
  resolve: { alias: [
    { find: /^sanity$/, replacement: resolve(folder, 'mock-sanity.ts') },
    { find: /^sanity\/router$/, replacement: resolve(folder, 'mock-router.ts') },
  ] },
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 4335, strictPort: true }, logLevel: 'error',
});
let browser;
const reports = [];
const external = [];
const errors = [];
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 1050 }, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith('http://127.0.0.1:4335/') && !url.startsWith('blob:') && !url.startsWith('data:')) {
      external.push(url); return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4335/.cache/pdf-studio-check/');
  await expect(page.getByRole('heading', { name: 'Importer un PDF', exact: true })).toBeVisible();
  await page.locator('#pdf-import-file').setInputFiles(resolve(artifacts, 'fixtures/texte.pdf'));
  await expect(page.getByRole('heading', { name: '2. Vérifier le résultat', exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('region', { name: 'Texte extrait du PDF' })).toContainText(/relations/i);
  const before = await page.evaluate(() => ({ uploads: window.__pdfMock.uploads.length, calls: window.__pdfMock.calls.length }));
  assert.deepEqual(before, { uploads: 0, calls: 0 });
  reports.push({ check: 'Real text PDF analysis, no upload or document before Create', result: 'passed' });
  const title = 'Relations au travail — essai local';
  const excerpt = 'Résumé ajusté dans le formulaire de recette locale.';
  await page.getByLabel('Titre de l’article', { exact: true }).fill(title);
  await page.getByLabel('Résumé — extrait du début du document, à ajuster', { exact: true }).fill(excerpt);
  await page.screenshot({ path: resolve(artifacts, 'studio-analysis-ready.png'), fullPage: true });
  const create = page.getByRole('button', { name: 'Créer le brouillon', exact: true });
  await create.evaluate(button => { button.click(); button.click(); });
  await page.waitForFunction(() => window.__pdfMock.uploads.length === 1 && window.__pdfMock.releaseUpload);
  assert.equal(await page.evaluate(() => window.__pdfMock.uploads.length), 1);
  assert.equal(await page.evaluate(() => window.__pdfMock.calls.length), 0);
  await expect(page.getByRole('button', { name: 'Enregistrement…', exact: true })).toBeDisabled();
  await page.evaluate(() => window.__pdfMock.releaseUpload());
  await page.waitForFunction(() => window.__pdfMock.calls.length === 1 && window.__pdfMock.releaseFailure);
  const first = await page.evaluate(() => window.__pdfMock.calls[0]);
  assert.match(first._id, /^drafts\.[a-f0-9-]{36}$/);
  assert.equal(first._type, 'article');
  assert.equal(first.title, title);
  assert.equal(first.excerpt, excerpt);
  assert.equal(first.sourcePdf.asset._ref, `file-${'a'.repeat(40)}-pdf`);
  assert.equal(first.pdfImport.reviewed, false);
  assert.equal(first.pdfImport.pageCount, 1);
  assert.equal(first.pdfImport.ocrPages, 0);
  assert.equal('author' in first, false);
  assert.equal('date' in first, false);
  assert(first.body.length > 0);
  reports.push({ check: 'Double click guarded; new draft with source PDF, reviewed=false, no invented author/date', result: 'passed' });
  await page.evaluate(() => window.__pdfMock.releaseFailure());
  await expect(page.getByRole('alert')).toContainText('création du brouillon n’a pas pu être confirmée');
  await expect(page.getByLabel('Titre de l’article', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Résumé — extrait du début du document, à ajuster', { exact: true })).toBeDisabled();
  await expect(page.getByText('Une création a déjà été tentée.', { exact: false })).toBeVisible();
  await page.screenshot({ path: resolve(artifacts, 'studio-retry-response-lost.png'), fullPage: true });
  await page.getByRole('button', { name: 'Réessayer la création du brouillon', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Votre article est prêt à relire.', exact: true })).toBeVisible();
  const final = await page.evaluate(() => ({ uploads: window.__pdfMock.uploads, calls: window.__pdfMock.calls, documents: window.__pdfMock.documents }));
  assert.equal(final.uploads.length, 1);
  assert.equal(final.calls.length, 2);
  assert.deepEqual(final.calls[0], final.calls[1]);
  assert.deepEqual(Object.keys(final.documents), [first._id]);
  reports.push({ check: 'Lost creation response retried with same payload/UUID; one upload, one document', result: 'passed' });
  await page.getByRole('button', { name: 'Ouvrir le brouillon', exact: true }).click();
  const intents = await page.evaluate(() => window.__pdfMock.intents);
  assert.deepEqual(intents, [{ intent: 'edit', params: { id: first._id.replace(/^drafts\./, ''), type: 'article' } }]);
  reports.push({ check: 'Open draft invokes the article editing intent', result: 'passed' });
  await page.screenshot({ path: resolve(artifacts, 'studio-draft-created.png'), fullPage: true });
  assert.deepEqual(external, [], 'No external request or real Sanity API');
  assert.deepEqual(errors, [], 'No unhandled browser error');
  const report = { label: 'Recette locale, accès Sanity simulés', browser: 'Chromium', externalRequests: external.length, browserErrors: errors, reports };
  await writeFile(resolve(artifacts, 'studio-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
