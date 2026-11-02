/** Explicit, local-only editorial correction. Never run by install, build, or startup. */
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { closeDatabase, getPool } from '../apps/web/src/server/db';
import { ContentError, homeSchema, type EditorialActor } from '../apps/web/src/server/content/models';
import { getContent, publishContent, saveContent } from '../apps/web/src/server/content/repository';
import { stableContentId } from '../apps/web/src/server/content/seed-plan';

export const previous = {
  intro: 'Tensions, désengagement, relations tendues, départs : les fragilités d’une organisation se jouent souvent dans les relations de travail. Calas Conseil vous aide à comprendre l’origine des difficultés, puis à agir concrètement sur l’organisation, le management et les dynamiques d’équipe.',
  diagnostic: 'Écouter le travail réel. Comprendre ce qui fragilise l’organisation, les relations et les personnes. Faire émerger des priorités d’action concrètes, avec les acteurs de votre entreprise.',
  reasons: [
    'L’expérience de la direction RH et le regard de la psychologie clinique se rencontrent pour comprendre les réalités de l’entreprise et les dynamiques humaines.',
    'Les émotions, les croyances et les mécanismes relationnels influencent les comportements. Nous les examinons avec les conditions et l’organisation du travail, sans réduire les difficultés aux personnes.',
    'Du diagnostic à l’action, nous accompagnons les évolutions dans la durée pour les ancrer dans les pratiques quotidiennes, au-delà des formations ponctuelles.',
  ],
};

// Frozen correction text: later edits to demo.ts must never change this dated operation.
export const corrected = {
  intro: 'Stress, tensions, désengagement, départs : ce qui fragilise une entreprise commence souvent dans la relation.\n\nCALAS Conseil vous aide à comprendre l’origine des difficultés, puis à agir concrètement sur l’organisation, le management et les dynamiques d’équipe.',
  diagnostic: 'L’évaluation des risques psychosociaux est une obligation. Nous en faisons un vrai outil de pilotage : une lecture précise de ce qui fragilise le travail (l’organisation, les relations, les personnes) et des priorités d’action concrètes.',
  reasons: [
    'Au croisement de l’entreprise et de l’humain : une ancienne DRH habilitée IPRP, qui connaît les réalités et les contraintes de l’entreprise, et une psychologue clinicienne, qui apporte un éclairage sur les dynamiques humaines et relationnelles.',
    'Derrière les tensions, des émotions, des croyances et des mécanismes relationnels influencent les comportements. C’est à ce niveau que nous intervenons, pour comprendre ce qui se joue et faire évoluer durablement les situations.',
    'Du diagnostic à l’action : nous mobilisons nos propres outils pour accompagner les transformations dans la durée, au-delà des formations ponctuelles, afin d’ancrer les changements dans les pratiques quotidiennes.',
  ],
};

export function assertLocalTarget(environment: NodeJS.ProcessEnv): void {
  if (!['development', 'test'].includes(environment.SITE_ENV || '') || environment.CONTENT_MODE !== 'database') throw new Error('Cette correction exige la base locale en mode development ou test.');
  const database = new URL(environment.DATABASE_URL || '');
  const site = new URL(environment.SITE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '15432' || database.pathname !== '/calas_development' || database.search) throw new Error('Seule la base locale calas_development, port 15432, est autorisée.');
  if (site.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(site.hostname) || site.port !== '4321') throw new Error('Seul le site local sur le port 4321 est autorisé.');
}

export function planCorrection(input: unknown) {
  const content = homeSchema.parse(structuredClone(input));
  const changes: string[] = [];
  function replace(current: string, old: string, target: string, field: string) {
    if (current === target) return target;
    if (current !== old) throw new Error(`Modification éditoriale à préserver dans ${field} : aucune écriture effectuée.`);
    changes.push(field);
    return target;
  }
  content.intro = replace(content.intro, previous.intro, corrected.intro, 'intro');
  content.diagnostic.text = replace(content.diagnostic.text, previous.diagnostic, corrected.diagnostic, 'diagnostic.text');
  content.reasons.forEach((reason, index) => { reason.text = replace(reason.text || '', previous.reasons[index]!, corrected.reasons[index]!, `reasons[${index}].text`); });
  return { content, changes };
}

export function hasOnlyCorrectionChanges(draft: unknown, published: unknown): boolean {
  const remaining = (value: unknown) => {
    const home = homeSchema.parse(structuredClone(value));
    home.intro = corrected.intro;
    home.diagnostic.text = corrected.diagnostic;
    home.reasons.forEach((reason, index) => { reason.text = corrected.reasons[index]!; });
    // getContent hydrates statistics, which have a distinct editorial cycle.
    home.statistics = [];
    return home;
  };
  return isDeepStrictEqual(remaining(draft), remaining(published));
}

async function main(): Promise<void> {
  try {
    try { loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url))); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const flags = process.argv.slice(2);
    const actorFlag = flags.find(flag => flag.startsWith('--actor-id='));
    if (flags.some(flag => !['--dry-run', '--apply', '--publish-local'].includes(flag) && flag !== actorFlag) || new Set(flags).size !== flags.length || (flags.includes('--apply') && flags.includes('--dry-run')) || (flags.includes('--publish-local') && !flags.includes('--apply'))) throw new Error('Options : --dry-run (défaut), ou --apply --actor-id=ID [--publish-local].');
    assertLocalTarget(process.env);
    const detail = await getContent(stableContentId('home', 'home'));
    const plan = planCorrection(detail.content);
    const { rows } = await getPool().query<{ content: unknown }>('SELECT content FROM content_revisions WHERE id=$1 AND document_id=$2', [detail.publishedRevisionId, detail.id]);
    const publishable = rows.length === 1 && hasOnlyCorrectionChanges(detail.content, rows[0]!.content);
    console.log(`Accueil local : version ${detail.version}, ${plan.changes.length} correction(s) à appliquer.`);
    for (const field of plan.changes) console.log(`Champ : ${field}`);
    console.log(`Publication locale sans autre changement inédit : ${publishable ? 'possible' : 'refusée'}.`);
    if (!flags.includes('--apply')) {
      console.log('Simulation : aucune révision créée, aucune publication.');
      return;
    }
    if (flags.includes('--publish-local') && !publishable) throw new Error('Un autre brouillon diffère de la version publiée, ou aucune publication ne sert de référence. La publication automatique est refusée.');
    if (!actorFlag?.slice('--actor-id='.length)) throw new Error('Un compte administrateur local explicite est requis (--actor-id=ID).');
    const actorId = actorFlag.slice('--actor-id='.length);
    const account = await getPool().query<EditorialActor>('SELECT id,name,role FROM auth_user WHERE id=$1 AND role=$2 AND email_verified=true AND disabled=false', [actorId, 'administrator']);
    if (account.rows.length !== 1) throw new Error('Ce compte administrateur local est absent, suspendu ou non vérifié.');
    const actor = account.rows[0]!;
    const expectedVersion = detail.version + (plan.changes.length ? 1 : 0);
    if (plan.changes.length) {
      await saveContent(detail.id, plan.content, detail.version, actor);
      console.log('Correction enregistrée dans une nouvelle révision.');
    } else console.log('Les cinq champs sont déjà corrigés ; aucune révision de sauvegarde créée.');
    if (flags.includes('--publish-local')) {
      // Never use the post-save read's version: a concurrent save must cause a conflict.
      if (!plan.changes.length && !detail.hasUnpublishedChanges) console.log('La correction est déjà publiée localement.');
      else {
        await publishContent(detail.id, expectedVersion, actor);
        console.log('Correction publiée sur la recette locale uniquement.');
      }
    } else console.log('La version publique est conservée.');
  } catch (error) {
    console.error(error instanceof ContentError ? `${error.code} : ${error.message}` : error instanceof Error && !('query' in error) && !('parameters' in error) && !('code' in error) ? error.message : 'Correction interrompue ; aucun secret ni contenu privé journalisé.');
    process.exitCode = 1;
  } finally { await closeDatabase(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
