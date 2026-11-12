// Public, read-only acceptance of the two named registrations. No login or mail.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const input = process.argv[2] || process.env.CALAS_TEST_BASE_URL || 'http://localhost:4336';
const origin = new URL(input);
const production = origin.origin === 'https://www.calas-conseil.fr';
assert(origin.pathname === '/' && !origin.search && !origin.hash && !origin.username && !origin.password);
assert(production || (origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)), 'Use the local recipe or the canonical production origin');
const output = resolve('artifacts/agnes-iprp-20261112', production ? 'production' : 'local');
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base: origin.origin, checks: [], pageErrors: 0, blockedWrites: 0, blockedExternalRequests: 0, publicPdfRequests: 0, status: 'running' };
const browser = await chromium.launch({ headless: true });
let stage = 'initialisation';
const deadline = setTimeout(() => { console.error('Recette IPRP interrompue à l’étape : '+stage); void browser.close(); }, 120_000);
try {
  async function publicContext(javaScriptEnabled) {
    const context = await browser.newContext({ javaScriptEnabled, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) { report.blockedWrites++; return route.abort(); }
    if (url.origin !== origin.origin) { report.blockedExternalRequests++; return route.abort(); }
    if (url.pathname.toLowerCase().endsWith('.pdf')) { report.publicPdfRequests++; return route.abort(); }
    return route.continue();
    });
    return context;
  }
  const context = await publicContext(false);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(15_000);
  page.on('pageerror', () => report.pageErrors++);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const [path, name, articles] of [
      ['/', 'home', '.home-people article'],
      ['/qui-sommes-nous/', 'people', '.editorial-profile'],
    ]) {
      stage = `${name}-${width}`;
      console.log('Contrôle '+stage);
      assert.equal((await page.goto(new URL(path, origin).href)).status(), 200);
      stage += '-fonts';
      await page.evaluate(() => document.fonts.ready);
      const agnes = page.locator(articles).filter({ has: page.getByRole('heading', { name: 'Agnès Loupias', exact: true }) });
      const sara = page.locator(articles).filter({ has: page.getByRole('heading', { name: 'Sara Serrano Cabeza', exact: true }) });
      await expect(agnes).toHaveCount(1); await expect(sara).toHaveCount(1);
      const agnesIprp = agnes.getByRole('complementary', { name: 'Enregistrement IPRP – Agnès Loupias', exact: true });
      const agnesRpps = agnes.getByRole('complementary', { name: 'Enregistrement RPPS – Agnès Loupias', exact: true });
      const saraIprp = sara.getByRole('complementary', { name: 'Enregistrement IPRP – Sara Serrano Cabeza', exact: true });
      await expect(agnes.locator('.registration')).toHaveCount(2);
      await expect(sara.locator('.registration')).toHaveCount(1);
      await expect(agnesIprp).toHaveCount(1); await expect(agnesRpps).toHaveCount(1);
      await expect(agnesIprp.locator('.registration-number')).toContainText('2026090231067');
      await expect(agnesIprp).toContainText('DREETS Occitanie');
      await expect(agnesIprp).not.toContainText('2026.16.004');
      await expect(agnesRpps.locator('.registration-number')).toContainText('10009722090');
      await expect(saraIprp.locator('.registration-number')).toContainText('2026.16.004');
      await expect(saraIprp).toContainText('DREETS Nouvelle-Aquitaine');
      await expect(saraIprp).not.toContainText('2026090231067');
      for (const card of [agnesIprp, saraIprp]) {
        await card.scrollIntoViewIfNeeded();
        const box = await card.evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, background: getComputedStyle(element).backgroundColor, scroll: element.scrollWidth, client: element.clientWidth }));
        assert.equal(box.background, 'rgb(255, 255, 255)');
        assert(box.scroll <= box.client + 1); assert(Math.abs(box.width - box.height) <= 1, 'Profile badge stays square');
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow');
      await agnes.screenshot({ path: resolve(output, `${name}-agnes-${width}.png`) });
      await agnes.locator('.profile-registrations').screenshot({ path: resolve(output, `${name}-agnes-badges-${width}.png`) });
      await sara.locator('.profile-registrations').screenshot({ path: resolve(output, `${name}-sara-badge-${width}.png`) });
      report.checks.push({ page: path, width, javascript: false, reducedMotion: true, agnesIprp: '2026090231067', agnesRpps: '10009722090', saraIprp: '2026.16.004', overflow: false });
    }
    stage = `diagnostic-${width}`;
    assert.equal((await page.goto(new URL('/diagnostic-rps/', origin).href)).status(), 200);
    const registration = page.locator('.diagnostic-registration');
    await expect(registration).toHaveCount(1);
    await expect(registration).toHaveAttribute('aria-label', 'Enregistrement IPRP – Sara Serrano Cabeza');
    await expect(registration).toContainText('2026.16.004');
    await expect(registration).toContainText('DREETS Nouvelle-Aquitaine');
    await expect(registration).not.toContainText('2026090231067');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await registration.screenshot({ path: resolve(output, `diagnostic-sara-${width}.png`) });
    report.checks.push({ page: '/diagnostic-rps/', width, javascript: false, reducedMotion: true, saraRegistrationUnchanged: true, overflow: false });
  }
  await context.close();
  // Axe injects its engine into the page. Keep this separate from the no-JS proof.
  const accessibleContext = await publicContext(true);
  const accessiblePage = await accessibleContext.newPage();
  accessiblePage.setDefaultTimeout(15_000); accessiblePage.setDefaultNavigationTimeout(15_000);
  accessiblePage.on('pageerror', () => report.pageErrors++);
  for (const width of [390, 1440]) {
    await accessiblePage.setViewportSize({ width, height: 960 });
    for (const [path, articles] of [['/', '.home-people article'], ['/qui-sommes-nous/', '.editorial-profile']]) {
      stage = `accessibility-${path}-${width}`;
      console.log('Contrôle '+stage);
      assert.equal((await accessiblePage.goto(new URL(path, origin).href)).status(), 200);
      const accessibility = await new AxeBuilder({ page: accessiblePage }).include(articles).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      assert.deepEqual(accessibility.violations, []);
      report.checks.push({ page: path, width, javascript: true, reducedMotion: true, accessibilityViolations: 0 });
    }
  }
  assert.equal(report.pageErrors, 0); assert.equal(report.blockedWrites, 0); assert.equal(report.blockedExternalRequests, 0); assert.equal(report.publicPdfRequests, 0);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.stage = stage; report.error = error instanceof Error ? error.message.slice(0, 1500) : 'Unknown failure'; process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  await browser.close();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
