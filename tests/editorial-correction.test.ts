import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { ContentError, parseContent } from '../apps/web/src/server/content/models';
import { prepareSeedPlan } from '../apps/web/src/server/content/seed-plan';
import type { SiteContent } from '../apps/web/src/lib/cms/types';
import { november2ClosingQuote, planNovember2Correction } from '../scripts/content-correct-editorial-20261102';

const previous = JSON.parse(readFileSync(new URL('../scripts/editorial/brief-20261101-after.json', import.meta.url), 'utf8')) as SiteContent;
const oldPlan = prepareSeedPlan(previous);
const before = (kind: 'home' | 'settings') => structuredClone(oldPlan.entries.find(entry => entry.kind === kind)!.content);
// Only the eight home fields and the qualification label changed on 2 November.
const approved = JSON.parse(readFileSync(new URL('./fixtures/editorial-20261102.json', import.meta.url), 'utf8')) as {
  cards: Array<{ key: string; lead: string; text: string }>;
  conviction: { text: string; closingQuote: string };
  qualificationLabel: string;
};
const november2 = structuredClone(previous);
for (const patch of approved.cards) {
  const card = november2.home.journey!.cards.find(item => item.key === patch.key);
  assert.ok(card);
  Object.assign(card, patch);
}
Object.assign(november2.home.conviction, approved.conviction);
november2.settings.qualification.label = approved.qualificationLabel;
const after = prepareSeedPlan(november2);

test('le 2 novembre sépare les trois accroches et la phrase finale une seule fois', () => {
  for (const kind of ['home', 'settings'] as const) {
    const input = before(kind);
    const unchanged = structuredClone(input);
    const result = planNovember2Correction(kind, input);
    assert.equal(result.changes.length, kind === 'home' ? 8 : 1);
    assert.deepEqual(input, unchanged);
    assert.deepEqual(planNovember2Correction(kind, result.content), { content: result.content, changes: [] });
    assert.doesNotThrow(() => parseContent(kind, result.content));
    assert.deepEqual(result.content, after.entries.find(entry => entry.kind === kind)!.content);
  }
});

test('les photographies récentes, champs hors correction et statut pending sont conservés', () => {
  const visuals = Object.fromEntries(['kintsugi', 'ripples', 'calmFace', 'closing'].map(key => [key, { mediaId: randomUUID(), alt: `Photo ${key}`, width: 1600, height: 900, crop: { top: 0.1, bottom: 0, left: 0, right: 0 }, hotspot: { x: 0.4, y: 0.3, width: 0.1, height: 0.1 } }]));
  const input = { ...before('home'), visuals, closingTitle: 'Une invitation relue dans le CMS' };
  const result = planNovember2Correction('home', input).content;
  assert.deepEqual(result.visuals, visuals);
  assert.equal(result.closingTitle, input.closingTitle);
  const settings = before('settings');
  const initial = settings.qualification as Record<string, unknown>;
  const qualification = planNovember2Correction('settings', settings).content.qualification as Record<string, unknown>;
  assert.equal(qualification.status, 'pending');
  assert.equal(qualification.personId, initial.personId);
  assert.equal(qualification.registration, initial.registration);
});

test('une réécriture des champs ciblés ou une carte manquante bloque sans modifier l’entrée', () => {
  const input = before('home');
  (input.conviction as Record<string, unknown>).text = 'Texte modifié dans l’administration';
  const unchanged = structuredClone(input);
  assert.throws(() => planNovember2Correction('home', input), /conviction.text/);
  assert.deepEqual(input, unchanged);
  const partial = before('home');
  (partial.journey as { cards: unknown[] }).cards.pop();
  assert.throws(() => planNovember2Correction('home', partial), /trois étapes/);
  const settings = before('settings');
  (settings.qualification as Record<string, unknown>).registration = 'Autre numéro';
  assert.throws(() => planNovember2Correction('settings', settings), /titulaire/);
});

test('les nouveaux champs CMS restent facultatifs et bornés, les anciens contenus lisibles', () => {
  assert.doesNotThrow(() => parseContent('home', before('home')));
  const corrected = planNovember2Correction('home', before('home')).content;
  assert.equal((corrected.conviction as Record<string, unknown>).closingQuote, november2ClosingQuote);
  assert.throws(() => parseContent('home', { ...corrected, conviction: { ...(corrected.conviction as Record<string, unknown>), closingQuote: 'x'.repeat(501) } }), ContentError);
  const tooLong = structuredClone(corrected);
  (tooLong.journey as { cards: Array<Record<string, unknown>> }).cards[0].lead = 'x'.repeat(351);
  assert.throws(() => parseContent('home', tooLong), ContentError);
});
