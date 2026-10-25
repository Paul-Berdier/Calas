import { test, expect } from '@playwright/test';
import { createPreviewSession, verifyPreviewSession, safePreviewRedirect, PREVIEW_TTL } from '../apps/web/src/lib/cms/preview';
import { createServerClient } from '../apps/web/src/lib/cms/client';

const envKeys = ['PREVIEW_SESSION_SECRET', 'SANITY_API_READ_TOKEN', 'PUBLIC_SANITY_PROJECT_ID', 'PUBLIC_SANITY_DATASET'] as const;
let previous: Record<string, string | undefined>;

test.describe('Frontière de sécurité CMS — tests locaux sans compte Sanity', () => {
  test.beforeEach(() => {
    previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    process.env.PREVIEW_SESSION_SECRET = 'test-only-never-deploy-0123456789abcdef';
    process.env.SANITY_API_READ_TOKEN = 'unit-test-token-not-a-real-credential';
    process.env.PUBLIC_SANITY_PROJECT_ID = 'calas-test';
    process.env.PUBLIC_SANITY_DATASET = 'staging';
  });
  test.afterEach(() => {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  test('une session signée est valide, puis expire au bout d’une heure', () => {
    const now = Math.floor(Date.now() / 1000) * 1000;
    const session = createPreviewSession(now);
    expect(verifyPreviewSession(session, now)).toBe(true);
    expect(verifyPreviewSession(session, now + PREVIEW_TTL * 1000 - 1)).toBe(true);
    expect(verifyPreviewSession(session, now + PREVIEW_TTL * 1000)).toBe(false);
  });

  test('refuse le cookie forgé, le payload modifié et la clé révoquée', () => {
    const now = Date.now();
    const session = createPreviewSession(now);
    const [payload, signature] = session.split('.') as [string, string];
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    claims.exp += 86400;
    const changed = `${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`;
    expect(verifyPreviewSession(changed, now)).toBe(false);
    expect(verifyPreviewSession('drafts', now)).toBe(false);
    expect(verifyPreviewSession('true', now)).toBe(false);
    expect(verifyPreviewSession('a'.repeat(4096), now)).toBe(false);
    expect(verifyPreviewSession(undefined, now)).toBe(false);
    process.env.PREVIEW_SESSION_SECRET = 'revoked-and-replaced-key-0123456789abcdef';
    expect(verifyPreviewSession(session, now)).toBe(false);
  });

  test('la session reste liée au dataset/projet et exige le jeton de lecture serveur', () => {
    const session = createPreviewSession();
    process.env.PUBLIC_SANITY_DATASET = 'production';
    expect(verifyPreviewSession(session)).toBe(false);
    process.env.PUBLIC_SANITY_DATASET = 'staging';
    process.env.PUBLIC_SANITY_PROJECT_ID = 'another-project';
    expect(verifyPreviewSession(session)).toBe(false);
    process.env.PUBLIC_SANITY_PROJECT_ID = 'calas-test';
    process.env.SANITY_API_READ_TOKEN = '';
    expect(verifyPreviewSession(session)).toBe(false);
  });

  test('les redirections ne quittent jamais le site et ne visent pas une API', () => {
    const origin = 'https://calas.example';
    for (const value of ['https://attacker.example/', '//attacker.example/', '/\\attacker.example/', '/api/preview/enable', '/contact/\r\nLocation: https://attacker.example']) {
      expect(safePreviewRedirect(value, origin)).toBe('/');
    }
    expect(safePreviewRedirect('/diagnostic-rps/?sanity-preview-secret=secret#etapes', origin)).toBe('/diagnostic-rps/#etapes');
    expect(safePreviewRedirect('/contact/?objet=equipes', origin)).toBe('/contact/?objet=equipes');
  });

  test('la lecture publique ne porte ni jeton ni perspective de brouillons', () => {
    const published = createServerClient(false).config();
    expect(published.perspective).toBe('published');
    expect(published.token).toBeUndefined();
    expect(published.useCdn).toBe(false);
    const draft = createServerClient(true).config();
    expect(draft.perspective).toBe('drafts');
    expect(draft.token).toBe('unit-test-token-not-a-real-credential');
    expect(draft.useCdn).toBe(false);
  });

  test('les nouveaux textes éditoriaux sont ciblables sans encoder les champs de navigation', () => {
    const filter = createServerClient(true).config().stega.filter;
    expect(filter).toBeDefined();
    const field = (sourcePath: Array<string | number>, allowed = true) => filter!({
      sourcePath, resultPath: sourcePath, value: 'Texte de recette',
      sourceDocument: { _id: 'homePage', _type: 'homePage' }, filterDefault: () => allowed,
    });
    expect(field(['editorial', 'heroAudience'])).toBe(true);
    expect(field(['editorial', 'heroDisciplines', 0])).toBe(true);
    expect(field(['statisticsTitle'])).toBe(true);
    expect(field(['sections', 0, 'instruction'])).toBe(true);
    expect(field(['sections', 0, 'presentation'])).toBe(false);
    expect(field(['editorial', 'reasonsLink', 'href'], false)).toBe(false);
    expect(field(['seo', 'title'], false)).toBe(false);
  });

  test('le site local refuse une activation arbitraire et reste sans cache', async ({ request }) => {
    const activation = await request.get('/api/preview/enable/?preview=true&sanity-preview-secret=invente', { maxRedirects: 0 });
    expect([401, 503]).toContain(activation.status());
    expect(activation.headers()['set-cookie']).toBeUndefined();
    expect(activation.headers()['cache-control']).toContain('no-store');
    expect(activation.headers()['x-robots-tag']).toContain('noindex');
    const publicPage = await request.get('/?preview=true', { headers: { Cookie: 'calas_preview=drafts; sanity-preview-perspective=drafts' } });
    expect(publicPage.status()).toBe(200);
    expect(await publicPage.text()).not.toContain('Brouillon — prévisualisation privée');
    expect(await publicPage.text()).not.toContain('unit-test-token-not-a-real-credential');
  });
});
