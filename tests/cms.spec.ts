import { test, expect } from '@playwright/test';

test.describe('Frontière HTTP du CMS propriétaire', () => {
  test('la session administrative ne peut être obtenue par un paramètre de preview', async ({ request }) => {
    const response = await request.get('/api/preview/enable/?preview=1&secret=invente', { maxRedirects: 0 });
    expect(response.status()).toBe(401);
    expect(response.headers()['set-cookie']).toBeUndefined();
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(response.headers()['x-robots-tag']).toContain('noindex');
  });

  test('les anciens cookies et un jeton Better Auth forgé ne donnent aucun brouillon', async ({ request }) => {
    for (const cookie of ['calas_preview=drafts; sanity-preview-perspective=drafts', 'better-auth.session_token=forged']) {
      const response = await request.get('/?preview=1', { headers: { Cookie: cookie } });
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).not.toContain('Brouillon — prévisualisation privée');
      expect(html).not.toContain('data-calas-preview');
      expect(html).not.toContain('Private draft title');
    }
  });

  test('le visiteur anonyme est dirigé vers la connexion sans recevoir les données admin', async ({ request }) => {
    const response = await request.get('/admin/', { maxRedirects: 0 });
    expect([302, 303]).toContain(response.status());
    expect(response.headers()['location']).toContain('/admin/login');
    expect(response.headers()['cache-control']).toContain('no-store');
    const login = await request.get('/admin/login/');
    expect(login.status()).toBe(200);
    expect(await login.text()).not.toContain('content_documents');
  });

  test('les API éditoriales et la médiathèque refusent les lectures anonymes', async ({ request }) => {
    for (const path of ['/api/admin/content/dashboard/', '/api/admin/content/pages/', '/api/admin/content/settings/', '/api/admin/media/']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
      expect(response.headers()['cache-control']).toContain('no-store');
      expect(response.headers()['x-robots-tag']).toContain('noindex');
      expect(await response.text()).not.toMatch(/password|token_hash|storage_key|postgresql:\/\//);
    }
  });

  test('la sortie de preview enlève le paramètre et refuse les redirections externes', async ({ request }) => {
    const exit = await request.get('/api/preview/disable/?path=%2Fdiagnostic-rps%2F%3Fpreview%3D1%23etapes', { maxRedirects: 0 });
    expect(exit.status()).toBe(303);
    expect(exit.headers()['location']).toBe('/diagnostic-rps/#etapes');
    expect(exit.headers()['set-cookie']).toBeUndefined();
    for (const path of ['https://attacker.example/', '//attacker.example/', '/api/admin/content/', '/admin/articles/']) {
      const response = await request.get(`/api/preview/disable/?path=${encodeURIComponent(path)}`, { maxRedirects: 0 });
      expect(response.headers()['location']).toBe('/');
    }
  });

  test('une panne de la base renvoie 503 sans contenus de démonstration ni diagnostic interne', async ({ request }) => {
    const response = await request.get('http://127.0.0.1:4324/');
    expect(response.status()).toBe(503);
    expect(response.headers()['cache-control']).toContain('no-store');
    const html = await response.text();
    expect(html).toContain('momentanément indisponible');
    expect(html).not.toMatch(/ContentUnavailableError|postgresql:\/\/|SELECT |39 %|Un constat largement partagé/);
  });

  test('le public ne charge pas les éditeurs ni le moteur PDF ou OCR', async ({ page }) => {
    const assets: string[] = [];
    page.on('request', request => { if (['script', 'worker'].includes(request.resourceType())) assets.push(request.url()); });
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    expect(assets.join('\n')).not.toMatch(/\/admin|tiptap|tesseract|pdf[.-]worker|better-auth|shadcn|ocr-models/i);
    await expect(page.locator('[data-calas-preview]')).toHaveCount(0);
  });
});

