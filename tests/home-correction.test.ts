import test from 'node:test';
import assert from 'node:assert/strict';
import { demoContent } from '../apps/web/src/lib/cms/demo';
import { homeSchema } from '../apps/web/src/server/content/models';
import { prepareSeedPlan } from '../apps/web/src/server/content/seed-plan';
import { assertLocalTarget, corrected, hasOnlyCorrectionChanges, planCorrection, previous } from '../scripts/content-correct-home-20261026';

const local = { CONTENT_MODE: 'database', SITE_ENV: 'development', SITE_URL: 'http://localhost:4321', DATABASE_URL: 'postgres://recipe:unused@127.0.0.1:15432/calas_development' };
function oldHome() {
  const home = homeSchema.parse(prepareSeedPlan(demoContent).entries.find(entry => entry.kind === 'home')!.content);
  home.intro = previous.intro;
  home.diagnostic.text = previous.diagnostic;
  home.reasons.forEach((reason, index) => { reason.text = previous.reasons[index]!; });
  return home;
}

test('la correction datée cible uniquement la recette PostgreSQL locale', () => {
  assert.doesNotThrow(() => assertLocalTarget(local));
  for (const environment of [
    { ...local, SITE_ENV: 'production' }, { ...local, SITE_ENV: 'staging' }, { ...local, CONTENT_MODE: 'demo' },
    { ...local, SITE_URL: 'https://calas-web-test-production.up.railway.app/' },
    { ...local, DATABASE_URL: 'postgres://recipe:unused@postgres.railway.internal:15432/calas_development' },
    { ...local, DATABASE_URL: 'postgres://recipe:unused@127.0.0.1:15439/calas_development' },
    { ...local, DATABASE_URL: 'postgres://recipe:unused@127.0.0.1:15432/calas_staging' },
    { ...local, DATABASE_URL: 'postgres://recipe:unused@127.0.0.1:15432/calas_development?host=remote' },
  ]) assert.throws(() => assertLocalTarget(environment));
});

test('les cinq champs seuls changent, sans toucher au contenu source ni aux autres brouillons', () => {
  const home = oldHome();
  home.title = 'Titre ajusté dans le CMS';
  home.reasons[0]!.title = 'Titre métier à conserver';
  const original = structuredClone(home);
  const plan = planCorrection(home);
  assert.deepEqual(home, original);
  assert.equal(plan.changes.length, 5);
  assert.equal(plan.content.title, home.title);
  assert.equal(plan.content.reasons[0]!.title, home.reasons[0]!.title);
  assert.equal(plan.content.intro, corrected.intro);
  assert.equal(plan.content.diagnostic.text, corrected.diagnostic);
  assert.deepEqual(plan.content.reasons.map(reason => reason.text), corrected.reasons);
  assert.equal(hasOnlyCorrectionChanges(plan.content, home), true);
  assert.equal(hasOnlyCorrectionChanges(plan.content, oldHome()), false);
});

test('une modification concurrente ou éditoriale d’un champ ciblé est refusée sans altération', () => {
  const home = oldHome();
  home.reasons[1]!.text = 'Texte rédigé depuis dans le CMS';
  const original = structuredClone(home);
  assert.throws(() => planCorrection(home), /reasons\[1\]\.text/);
  assert.deepEqual(home, original);
});

test('la correction déjà présente est idempotente et les textes de démo concordent', () => {
  const first = planCorrection(oldHome());
  const repeated = planCorrection(first.content);
  assert.equal(repeated.changes.length, 0);
  assert.deepEqual(repeated.content, first.content);
  assert.equal(planCorrection(prepareSeedPlan(demoContent).entries.find(entry => entry.kind === 'home')!.content).changes.length, 0);
  assert.equal(demoContent.settings.qualification.status, 'pending');
});
