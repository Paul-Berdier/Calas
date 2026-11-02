import { test, expect } from '@playwright/test';
import { linkedinArticles } from '../apps/web/src/lib/cms/linkedin-articles';

test('les cinq cartes indiquent LinkedIn et restent utilisables sans JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4322/reflexions/');
    await expect(page.locator('.journal-entry')).toHaveCount(5);
    for (const article of linkedinArticles) {
      const card = page.locator('.journal-entry').filter({ has: page.getByRole('heading', { name: article.title, exact: true }) });
      await expect(card.locator('a')).toHaveAttribute('href', article.externalUrl!);
      await expect(card.locator('a')).toHaveAttribute('rel', /noreferrer/);
      await expect(card).toContainText('Lire sur LinkedIn');
      await expect(card).toContainText('Sara Serrano Cabeza');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});

test('le relais local sert à la prévisualisation sans rediriger automatiquement vers LinkedIn', async ({ page }) => {
  const article = linkedinArticles[0]!;
  await page.goto(`/reflexions/${article.slug}/`);
  await expect(page).toHaveURL(new RegExp(`/reflexions/${article.slug}/$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.title);
  await expect(page.getByRole('link', { name: 'Lire sur LinkedIn' })).toHaveAttribute('href', article.externalUrl!);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('.reading-copy')).toContainText('publication originale sur LinkedIn');
});
