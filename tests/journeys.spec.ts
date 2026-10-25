import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const paths=['/','/diagnostic-rps/','/equipes/','/managers/','/notre-approche/','/qui-sommes-nous/','/reflexions/','/contact/','/mentions-legales/','/confidentialite/'];
test('all editorial routes render, one H1, internal links and clean runtime',async({page,request})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  const links=new Set<string>();
  for(const path of paths){const response=await page.goto(path);expect(response?.status(),path).toBe(200);await expect(page.locator('h1')).toHaveCount(1);await expect(page.locator('body')).not.toContainText(/CALASS|TODO|à fournir/);(await page.locator('a[href^="/"]').evaluateAll(els=>els.map(el=>(el as HTMLAnchorElement).pathname))).forEach(url=>links.add(url));}
  for(const path of links){expect((await request.get(path)).status(),path).toBe(200);}
  expect(errors).toEqual([]);
});
test('all offer contact subjects survive reload and new tab',async({page,context})=>{
  for(const [path,subject]of [['/diagnostic-rps/','diagnostic'],['/equipes/','equipes'],['/managers/','managers']]){
    await page.goto(path);const href=await page.locator(`a[href="/contact/?objet=${subject}"]`).first().getAttribute('href');expect(href).toBeTruthy();await page.locator(`a[href="/contact/?objet=${subject}"]`).first().click();await expect(page.locator('#subject')).toHaveValue(subject);await page.reload();await expect(page.locator('#subject')).toHaveValue(subject);const other=await context.newPage();await other.goto(href!);await expect(other.locator('#subject')).toHaveValue(subject);await other.close();
  }
});
test('mobile keyboard menu, skip link and escape',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Aller au contenu'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#contenu')).toBeFocused();const summary=page.locator('#mobile-menu summary');await summary.focus();await page.keyboard.press('Enter');await expect(summary).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Tab');await expect(page.locator('#mobile-panel a').first()).toBeFocused();await page.keyboard.press('Escape');await expect(summary).toBeFocused();await expect(summary).toHaveAttribute('aria-expanded','false');
});
test('server errors are associated; corrected form has actual simulated success',async({page})=>{
  await page.goto('/contact/?objet=diagnostic');await page.getByRole('button',{name:'Envoyer ma demande'}).click();await expect(page.locator('#name')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#error-email')).toContainText('valide');await expect(page.locator('#name')).toBeFocused();await page.locator('#name').fill('Recette Calas');await page.locator('#email').fill('recette@example.test');await page.locator('#message').fill('Demande de recette du diagnostic, sans donnée réelle.');await page.getByRole('button',{name:'Réessayer l’envoi'}).click();await expect(page.locator('#form-status')).toContainText('Aucun courriel');await expect(page.locator('.form-submit')).toBeDisabled();await expect(page.locator('#subject')).toHaveValue('diagnostic');
});
test('transport outage keeps fields and permits retry without false success',async({page})=>{
  await page.goto('http://127.0.0.1:4325/contact/?objet=equipes');await page.locator('#name').fill('Recette Calas');await page.locator('#email').fill('recette@example.test');await page.locator('#message').fill('Un message de recette sans information personnelle.');await page.locator('.form-submit').click();await expect(page.locator('#form-status')).toContainText('indisponible');await expect(page.locator('#message')).toHaveValue('Un message de recette sans information personnelle.');await expect(page.locator('#subject')).toHaveValue('equipes');await expect(page.locator('.form-submit')).toBeEnabled();await expect(page.locator('#form-status')).not.toHaveClass(/success/);
});
test('double click produces one request; timeout and network preserve input',async({page})=>{
  await page.goto('/contact/');await page.locator('#name').fill('Recette Calas');await page.locator('#email').fill('recette@example.test');await page.locator('#message').fill('Demande test conservée après une coupure de réseau.');let calls=0;await page.route('**/contact/',async route=>{if(route.request().method()==='POST'){calls++;await route.abort('failed');}else await route.continue();});await page.locator('.form-submit').dblclick({force:true});await expect(page.locator('#form-status')).toContainText('interrompue');expect(calls).toBe(1);await expect(page.locator('#message')).toHaveValue('Demande test conservée après une coupure de réseau.');
});
test('site and form remain usable without javascript',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const page=await context.newPage();await page.goto('http://127.0.0.1:4322/');await expect(page.locator('h1')).toBeVisible();await page.locator('#mobile-menu summary').click();await expect(page.locator('#mobile-panel')).toBeVisible();await page.goto('http://127.0.0.1:4322/contact/?objet=managers');await page.locator('#name').fill('Recette sans script');await page.locator('#message').fill('Une demande sans JavaScript doit conserver les valeurs.');await page.locator('.form-submit').click();await expect(page.locator('#subject')).toHaveValue('managers');await expect(page.locator('#name')).toHaveValue('Recette sans script');await expect(page.locator('#error-email')).toContainText('valide');await page.locator('#email').fill('recette@example.test');await page.locator('.form-submit').click();await expect(page.locator('#form-status')).toContainText('Aucun courriel');await context.close();
});
test('timeout preserves input and exposes a retry action',async({page})=>{
  await page.clock.install();await page.goto('/contact/?objet=managers');await page.locator('#name').fill('Recette Calas');await page.locator('#email').fill('recette@example.test');await page.locator('#message').fill('Une réponse trop lente doit laisser ce message intact.');
  await page.route('**/contact/',async route=>{if(route.request().method()!=='POST')await route.continue();});
  await page.locator('.form-submit').click();await expect(page.locator('.form-submit')).toBeDisabled();await page.clock.fastForward(15001);await expect(page.locator('#form-status')).toContainText('délai de réponse est dépassé');await expect(page.locator('#subject')).toHaveValue('managers');await expect(page.locator('#message')).toHaveValue('Une réponse trop lente doit laisser ce message intact.');await expect(page.locator('.form-submit')).toBeEnabled();
});
test('404, private headers, unknown draft and controlled CMS outage',async({page,request})=>{
  const missing=await page.goto('/une-page-absente/');expect(missing?.status()).toBe(404);await expect(page.locator('h1')).toContainText('Cette page');const article=await request.get('/reflexions/article-non-publie/');expect(article.status()).toBe(404);const response=await request.get('/?preview=true',{headers:{Cookie:'calas_preview=forged; sanity-preview-perspective=drafts'}});expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toContain('no-store');expect(await response.text()).not.toContain('Brouillon — prévisualisation privée');const outage=await request.get('http://127.0.0.1:4324/');expect(outage.status()).toBe(503);const body=await outage.text();expect(body).toContain('momentanément indisponible');expect(body).not.toMatch(/stack|token|ContentUnavailableError|39 %/);
});
test('axe on priority pages, menu and contact errors',async({page})=>{
  for(const width of [1280,390]){
    await page.setViewportSize({width,height:900});
    for(const path of ['/','/diagnostic-rps/','/contact/']){await page.goto(path);const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations,JSON.stringify(result.violations,null,2)).toEqual([]);}
  }
  await page.locator('.form-submit').click();await expect(page.locator('#error-name')).not.toBeEmpty();expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
});
