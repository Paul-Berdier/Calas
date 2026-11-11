import test from 'node:test';
import assert from 'node:assert/strict';
import { reviseOutreachNotice } from '../scripts/content-outreach-notice';
import { privacyNotice } from '../apps/web/src/lib/cms/legal';

test('privacy migration preserves unrelated fields, is idempotent and refuses editorial conflicts', () => {
  const old = { ...privacyNotice, intro: 'Introduction relue', sections: privacyNotice.sections.filter(s => s.key !== 'prospection').map(s => s.key === 'traceurs' ? { ...s, text: 'La consultation des pages publiques se fait sans traceur publicitaire ni outil de mesure d’audience. Les polices sont hébergées avec le site. L’administration et la prévisualisation utilisent des cookies techniques pour la connexion et la sécurité des comptes.' } : s) };
  const next = reviseOutreachNotice(old);
  assert.equal(next.intro, old.intro);
  assert.deepEqual(next.sections.filter(s => !['traceurs', 'prospection'].includes(s.key)), old.sections.filter(s => s.key !== 'traceurs'));
  assert.deepEqual(reviseOutreachNotice(next), next);
  assert.throws(() => reviseOutreachNotice({ ...old, sections: old.sections.map(s => s.key === 'traceurs' ? { ...s, text: 'Correction manuelle à préserver' } : s) }));
});
