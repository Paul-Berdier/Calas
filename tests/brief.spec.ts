import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('le nouveau chemin et le numéro IPRP sont visibles sans JavaScript',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:4322/');
 await expect(page.locator('main>section')).toHaveCount(7);
 await expect(page.locator('.journey-card')).toHaveCount(3);
 await expect(page.locator('.journey-lead strong em')).toHaveText(['Voir ce qui se joue avant d’agir.','Développer des compétences relationnelles.','Faire du manager un professionnel du lien.']);
 await expect(page.locator('.hero-identity em')).toHaveText('en stratégie RH.');
 await expect(page.locator('.hero-scroll')).toHaveAttribute('href','#chemin');
 await expect(page.locator('main>section').nth(1)).toHaveAttribute('id','chemin');
 await expect(page.locator('.home-now a')).toHaveText(['8 %','un sur deux']);
 await expect(page.locator('#conviction-title')).toContainText('professionnaliser le lien.');
 await expect(page.locator('.stat')).toHaveCount(9);
 const sara=page.locator('.home-people article').filter({has:page.getByRole('heading',{name:'Sara Serrano Cabeza'})});
 const agnes=page.locator('.home-people article').filter({has:page.getByRole('heading',{name:'Agnès Loupias'})});
 await expect(sara.locator('p')).toHaveText('Fondatrice de Calas Conseil, consultante en relations humaines et stratégie RH, ancienne DRH. IPRP et praticienne en analyse transactionnelle.');
 await expect(agnes.locator('p')).toHaveText('Associée, psychologue clinicienne');
 await expect(sara.getByRole('complementary',{name:/IPRP/})).toContainText('2026.16.004');
 await expect(sara.getByRole('complementary',{name:/IPRP/})).toContainText('DREETS Nouvelle-Aquitaine');
 await expect(agnes.getByRole('complementary',{name:/RPPS/})).toContainText('10009722090');
 await expect(sara.locator('.registration')).toHaveCount(1);
 await expect(agnes.locator('.registration')).toHaveCount(1);
 await page.locator('.sensitive-link').click();
 await expect(page.locator('h1')).toHaveText('Quand la relation se tend, agir vite et juste');
 await expect(page.locator('#section-cadre')).toContainText('jamais sur les confidences individuelles');
 await expect(page.locator('#section-cadre li')).toHaveCount(3);
 await expect(page.locator('.sensitive-call a')).toHaveAttribute('href','tel:+33643168381');
 await page.locator('a[href="/contact/?objet=sensible"]').first().click();
 await expect(page.locator('#subject')).toHaveValue('sensible');
 await context.close();
});

test('le menu des offres fonctionne au clavier sur ordinateur',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 const summary=page.locator('.offers-menu summary');await summary.focus();await page.keyboard.press('Enter');
 await expect(summary).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Tab');await expect(page.locator('.offers-panel a').first()).toBeFocused();
 await expect(page.locator('.offers-panel a')).toHaveCount(4);await page.keyboard.press('Escape');await expect(summary).toBeFocused();await expect(summary).toHaveAttribute('aria-expanded','false');
});

test('les illustrations chargent et les nouvelles pages restent lisibles',async({page},testInfo)=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:960});
  for(const [path,name] of [['/','home'],['/situations-sensibles/','situations'],['/qui-sommes-nous/','people'],['/equipes/','equipes'],['/managers/','managers']]){
   expect((await page.goto(path))?.status()).toBe(200);await page.evaluate(()=>document.fonts.ready);
   for(const img of await page.locator('main img:visible').all()){await img.scrollIntoViewIfNeeded();await expect(img).toHaveJSProperty('complete',true);expect(await img.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);}
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(path==='/situations-sensibles/')expect(await page.locator('#section-cadre .notice-content').evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(width<800?width*.65:300);
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:testInfo.outputPath(`${name}-${width}.png`),fullPage:true});
   if(path==='/'||path==='/situations-sensibles/')expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
  }
 }
 await page.goto('/qui-sommes-nous/');
 await expect(page.getByRole('complementary',{name:'Enregistrement IPRP – Sara Serrano Cabeza'})).toContainText('2026.16.004');
 await expect(page.getByRole('complementary',{name:'Enregistrement RPPS – Agnès Loupias'})).toContainText('10009722090');
 const schema=await page.locator('script[type="application/ld+json"]').allTextContents();expect(schema.some(text=>JSON.parse(text)['@graph']?.filter((node:Record<string,string>)=>node['@type']==='Person').length===2)).toBe(true);
});
