import test from 'node:test';
import assert from 'node:assert/strict';
import { briefChanges, correctedBrief, planBriefCorrection, previousBrief, publicationIncludesOnlyBrief } from '../scripts/content-correct-brief-20261101';
import { prepareSeedPlan } from '../apps/web/src/server/content/seed-plan';
import { assertPublishable } from '../apps/web/src/server/content/models';

test('le nouveau cahier produit les sept blocs, quatre offres et six chiffres sourcés', () => {
  const plan = prepareSeedPlan(correctedBrief);
  assert.equal(plan.warnings.length, 0);
  assert.equal(correctedBrief.home.journey?.cards.length, 3);
  assert.ok(correctedBrief.home.whyNow);
  assert.equal(correctedBrief.home.statistics.length, 6);
  assert.equal(correctedBrief.pages.find(page => page.slug === 'situations-sensibles')?.sections[0]?.items?.length, 5);
  assert.equal(correctedBrief.settings.qualification.status, 'pending');
  assert.equal(correctedBrief.settings.qualification.registration, '2026.16.004');
  assert.equal(correctedBrief.settings.qualification.personId, 'person-sara');
  assert.equal(correctedBrief.settings.email, previousBrief.settings.email);
  for (const entry of plan.entries) assert.doesNotThrow(() => assertPublishable(entry.kind, entry.content));
});

test('l’import applique les changements datés une fois et conserve les champs non ciblés', () => {
  for (const change of briefChanges) {
    const first = planBriefCorrection(change, change.before?.content);
    assert.ok(first.changes.length);
    assert.deepEqual(planBriefCorrection(change, first.content).changes, []);
    assert.deepEqual(planBriefCorrection(change, first.content).content, first.content);
  }
  const settings = briefChanges.find(change => change.after.kind === 'settings')!;
  const current = { ...structuredClone(settings.before!.content), contactText: 'Texte déjà ajusté par Sara' };
  assert.equal(planBriefCorrection(settings, current).content.contactText, 'Texte déjà ajusté par Sara');
  assert.equal(publicationIncludesOnlyBrief(settings, current, settings.before!.content), false);
});

test('une modification concurrente ciblée ou une nouvelle identité déjà occupée arrête le plan', () => {
  const home = briefChanges.find(change => change.after.kind === 'home')!;
  const current = { ...structuredClone(home.before!.content), title: 'Titre modifié dans l’administration' };
  const unchanged = structuredClone(current);
  assert.throws(() => planBriefCorrection(home, current), /title/);
  assert.deepEqual(current, unchanged);
  assert.throws(() => planBriefCorrection(home), /absent/);
  const created = briefChanges.find(change => !change.before && change.after.kind === 'page')!;
  assert.throws(() => planBriefCorrection(created, { ...created.after.content, title: 'Un autre brouillon' }), /différent/);
});

test('une publication ne peut embarquer un autre brouillon et garde les statistiques indépendantes', () => {
  const home = briefChanges.find(change => change.after.kind === 'home')!;
  const draft = planBriefCorrection(home, home.before!.content).content;
  assert.equal(publicationIncludesOnlyBrief(home, draft, home.before!.content), true);
  assert.equal(publicationIncludesOnlyBrief(home, { ...draft, closingTitle: 'Une autre proposition' }, home.before!.content), false);
  assert.deepEqual(planBriefCorrection(home, { ...draft, statistics: prepareSeedPlan(correctedBrief).entries.filter(entry => entry.kind === 'statistic').map(entry => entry.content) }).content.statistics, []);
});
