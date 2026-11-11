/** Explicit editorial migration; never imported by build, startup or SQL migrations. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { eq, sql } from '../apps/web/node_modules/drizzle-orm/index.js';
import { privacyNotice } from '../apps/web/src/lib/cms/legal';
import type { Section } from '../apps/web/src/lib/cms/types';
import { closeDatabase, getDb } from '../apps/web/src/server/db';
import { user } from '../apps/web/src/server/db/auth-schema';
import { revisePublishedStructure } from '../apps/web/src/server/content/repository';
import { stableContentId } from '../apps/web/src/server/content/seed-plan';

const priorNavigation = 'La consultation des pages publiques se fait sans traceur publicitaire ni outil de mesure d’audience. Les polices sont hébergées avec le site. L’administration et la prévisualisation utilisent des cookies techniques pour la connexion et la sécurité des comptes.';
export function reviseOutreachNotice(content: Record<string, unknown>) {
  if (content.slug !== 'confidentialite' || !Array.isArray(content.sections)) throw new Error('Page de confidentialité attendue.');
  const sections = structuredClone(content.sections) as Section[];
  for (const desired of privacyNotice.sections.filter(section => ['traceurs', 'prospection'].includes(section.key))) {
    const index = sections.findIndex(section => section.key === desired.key);
    if (index < 0) { sections.push(desired); continue; }
    const current = sections[index]!;
    if (isDeepStrictEqual(current, desired)) continue;
    if (current.key !== 'traceurs' || current.text !== priorNavigation || current.body) throw new Error(`Section ${current.key} modifiée par un éditeur : relecture requise avant remplacement.`);
    sections[index] = { ...current, title: desired.title, text: desired.text };
  }
  return { ...content, sections };
}

export async function updateOutreachNotice(apply: boolean, expectedDatabase: string, operatorId: string) {
  if (!expectedDatabase || !operatorId) throw new Error('CALAS_TARGET_DATABASE et CALAS_OPERATOR_ID requis.');
  return getDb().transaction(async tx => {
    const identity = await tx.execute(sql`SELECT current_database() AS database`);
    if (identity.rows[0]?.database !== expectedDatabase) throw new Error('La base ne correspond pas à la destination attendue.');
    const [operator] = await tx.select().from(user).where(eq(user.id, operatorId));
    if (!operator || operator.disabled || !operator.emailVerified || operator.role !== 'administrator') throw new Error('Administrateur actif et vérifié requis.');
    return revisePublishedStructure(tx, {
      id: stableContentId('page', 'confidentialite'), kind: 'page', apply,
      actor: { id: operator.id, name: operator.name, role: 'administrator' }, edit: reviseOutreachNotice,
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags = process.argv.slice(2);
  Promise.resolve().then(async () => {
    if (flags.join(' ') !== '--dry-run' && flags.join(' ') !== '--apply --publish') throw new Error('Indiquer --dry-run ou explicitement --apply --publish.');
    const result = await updateOutreachNotice(flags[0] === '--apply', process.env.CALAS_TARGET_DATABASE ?? '', process.env.CALAS_OPERATOR_ID ?? '');
    console.log(JSON.stringify({ mode: flags[0], result }));
  }).catch(() => { console.error('Notice non modifiée : vérifier la destination, les droits et les éventuelles corrections éditoriales. Aucun secret affiché.'); process.exitCode = 1; }).finally(closeDatabase);
}
