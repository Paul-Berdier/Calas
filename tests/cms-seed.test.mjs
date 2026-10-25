import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { demoContent } from '../apps/web/src/lib/cms/demo.ts';

const built = await build({ entryPoints: [fileURLToPath(new URL('../apps/web/src/server/content/seed-plan.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent' });
const { prepareSeedPlan, validateSeedPlan, stableContentId } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);

test('le contenu initial conserve les neuf pages et les objets éditables sans faux article', () => {
  const { entries, warnings } = prepareSeedPlan(demoContent);
  assert.equal(entries.length, 17);
  assert.equal(entries.filter(entry => entry.kind === 'page').length, 9);
  assert.equal(entries.filter(entry => entry.kind === 'article').length, 0);
  const diagnostic = entries.find(entry => entry.content.slug === 'diagnostic-rps');
  const method = diagnostic.content.sections.find(section => section.presentation === 'method');
  assert.equal(method.items.length, 5);
  const home = entries.find(entry => entry.kind === 'home');
  assert(home.content.editorial.heroAudience);
  assert(home.content.primaryCta.href);
  assert(home.content.statisticIds.every(id => entries.some(entry => entry.id === id && entry.kind === 'statistic')));
  assert.deepEqual(prepareSeedPlan(demoContent).entries, entries);
  assert.deepEqual(warnings, []);
});
test('le précontrôle refuse références cassées et identifiants de contenu dupliqués', () => {
  const broken = prepareSeedPlan(demoContent).entries;
  broken.find(entry => entry.kind === 'home').content.statisticIds[0] = stableContentId('statistic', 'missing');
  assert.throws(() => validateSeedPlan(broken), /Référence absente/);
  const duplicate = prepareSeedPlan(demoContent).entries;
  duplicate[1].id = duplicate[0].id;
  assert.throws(() => validateSeedPlan(duplicate), /identifiant unique/);
  const duplicateKey = prepareSeedPlan(demoContent).entries;
  const reasons = duplicateKey.find(entry => entry.kind === 'home').content.reasons;
  reasons[0].key = 'duplicate'; reasons[1].key = 'duplicate';
  assert.throws(() => validateSeedPlan(duplicateKey), /corrigés/);
});
