import {test,expect} from '@playwright/test';

test('diagnostic deep link and method work with the keyboard and without JavaScript',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:4322/diagnostic-rps/');
  await page.getByRole('link',{name:'Explorer la démarche'}).click();
  await expect(page).toHaveURL(/#section-etapes$/);
  const listening=page.locator('.method-sequence details').filter({has:page.locator('summary',{hasText:'Écouter'})});
  await listening.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(listening).toHaveAttribute('open','');
  await expect(listening.locator('p')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(listening.locator('p')).not.toBeVisible();
  const faq=page.locator('.faq-items details').first();
  await faq.locator('summary').click();
  await expect(faq.locator('p')).toBeVisible();
  await context.close();
});

test('secondary editorial pages stay within mobile and tablet widths',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [360,768]){
    await page.setViewportSize({width,height:900});
    for(const path of ['/equipes/','/managers/','/notre-approche/','/qui-sommes-nous/','/reflexions/','/contact/']){
      await page.goto(path);
      await page.evaluate(()=>document.fonts.ready);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} at ${width}px`).toBe(true);
      await expect(page.locator('h1')).toBeVisible();
    }
  }
});
