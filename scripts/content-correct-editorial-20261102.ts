/**
 * Corrections supplied in CORRECTIONS SITE AU 02-11.pdf.
 * Pure preparation only: no database access, save, publication or media import.
 * Every changed field accepts its known before/after value and refuses conflicts.
 * Existing media, person IDs, other editorial fields and qualification status are
 * deliberately preserved. The operator must review drafts before publication.
 */
export const november2Cards = [
  { key: 'diagnostic', beforeLead: 'Voir ce qui se joue avant d’agir.', lead: 'Voir ce qui se joue avant d’agir.', text: 'Un diagnostic des risques psychosociaux, utile à votre document unique (DUERP), pour lire les risques et les ressources de votre organisation avec justesse et décider sur une base claire.' },
  { key: 'equipes', beforeLead: 'Développer ses compétences relationnelles.', lead: 'Développer des compétences relationnelles.', text: 'Des processus d’apprentissage, conférences et ateliers, sur les émotions et les croyances pour mieux se comprendre, ajuster son comportement au sein du collectif et agir en conscience dans la relation.' },
  { key: 'managers', beforeLead: 'Faire du manager un professionnel du lien.', lead: 'Faire du manager un professionnel du lien.', text: 'Un parcours sur la posture, pour que chaque manager devienne un point d’appui pour son équipe.' },
] as const;

export const november2ClosingQuote = 'Quand on se sent en sécurité, on ose : c’est là que naît l’autonomie.';
export const november2ConvictionText = 'Une organisation tient par ses process, et plus encore par la qualité des liens entre les personnes qui la font vivre.\n\nChacun arrive au travail avec ses émotions qui expriment ce qui compte pour lui et font écho à ses valeurs, à ses aspirations et à ses croyances qui influencent sa manière de percevoir les situations et d’entrer en relation avec les autres. Émotions et croyances façonnent ainsi nos comportements et nos interactions.\n\nCes liens reposent sur l’authenticité, qui permet de parler vrai, et un cadre de sécurité, qui permet d’oser. Ils s’apprennent et s’entretiennent, par des rituels de conversation et des temps de régulation.';
export const november2QualificationLabel = 'IPRP enregistrée auprès de la DREETS Nouvelle-Aquitaine';

type Content = Record<string, unknown>;
export interface November2Change { path: string; before: unknown; after: unknown }
function record(value: unknown, path: string): Content {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Contenu absent ou invalide : ${path}.`);
  return value as Content;
}

export function planNovember2Correction(kind: 'home' | 'settings', input: unknown): { content: Content; changes: November2Change[] } {
  const content = structuredClone(record(input, kind));
  const changes: November2Change[] = [];
  const change = (target: Content, key: string, before: unknown, after: unknown, path: string) => {
    if (target[key] === after) return;
    if (target[key] !== before) throw new Error(`Conflit éditorial sur ${path} : relire la modification existante avant de continuer.`);
    changes.push({ path, before: target[key], after });
    target[key] = after;
  };
  if (kind === 'home') {
    const journey = record(content.journey, 'home.journey');
    if (!Array.isArray(journey.cards) || journey.cards.length !== 3) throw new Error('Conflit éditorial sur home.journey.cards : les trois étapes sont requises.');
    for (const correction of november2Cards) {
      const matching = journey.cards.filter(value => record(value, 'home.journey.cards').key === correction.key);
      if (matching.length !== 1) throw new Error(`Conflit éditorial sur home.journey.cards.${correction.key} : identité absente ou dupliquée.`);
      const card = record(matching[0], `home.journey.cards.${correction.key}`);
      change(card, 'lead', undefined, correction.lead, `journey.cards.${correction.key}.lead`);
      change(card, 'text', `${correction.beforeLead} ${correction.text}`, correction.text, `journey.cards.${correction.key}.text`);
    }
    const conviction = record(content.conviction, 'home.conviction');
    change(conviction, 'closingQuote', undefined, november2ClosingQuote, 'conviction.closingQuote');
    change(conviction, 'text', `${november2ConvictionText} ${november2ClosingQuote}`, november2ConvictionText, 'conviction.text');
  } else if (kind === 'settings') {
    const qualification = record(content.qualification, 'settings.qualification');
    if (qualification.registration !== '2026.16.004' || typeof qualification.personId !== 'string' || !qualification.personId) {
      throw new Error('Conflit éditorial sur settings.qualification : contrôler le numéro et la titulaire.');
    }
    change(qualification, 'label', 'IPRP enregistrée auprès de la DREETS', november2QualificationLabel, 'qualification.label');
  } else {
    throw new Error('La correction du 2 novembre cible uniquement home et settings.');
  }
  return { content, changes };
}
