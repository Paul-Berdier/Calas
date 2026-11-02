/** Voluntary, local-only import of the 31 October brief. Never invoked by build or startup. */
import { loadEnvFile } from 'node:process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { SiteContent } from '../apps/web/src/lib/cms/types';
import { closeDatabase, getPool } from '../apps/web/src/server/db';
import { ContentError, parseContent, type ContentDetail, type ContentKind, type EditorialActor } from '../apps/web/src/server/content/models';
import { createContent, getContent, publishContent, saveContent, seedDocuments } from '../apps/web/src/server/content/repository';
import { prepareSeedPlan, type SeedEntry } from '../apps/web/src/server/content/seed-plan';
import { assertLocalTarget } from './content-correct-home-20261026';

// Frozen sources keep this dated operation independent of later demo edits.
export const previousBrief = JSON.parse(readFileSync(new URL('./editorial/brief-20261101-before.json', import.meta.url), 'utf8')) as SiteContent;
export const correctedBrief = JSON.parse(readFileSync(new URL('./editorial/brief-20261101-after.json', import.meta.url), 'utf8')) as SiteContent;
export interface BriefChange { before?: SeedEntry; after: SeedEntry }
export const briefChanges: BriefChange[] = (() => {
  const before = new Map(prepareSeedPlan(previousBrief).entries.map(entry => [entry.id, entry]));
  return prepareSeedPlan(correctedBrief).entries.flatMap(after => {
    const old = before.get(after.id);
    return old && isDeepStrictEqual(old.content, after.content) ? [] : [{ before: old, after }];
  });
})();

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function normalized(kind: ContentKind, value: unknown): Record<string, unknown> {
  const parsed = parseContent(kind, structuredClone(value));
  // Home reads hydrate separately versioned statistics; never save those duplicate copies.
  if (kind === 'home') parsed.statistics = [];
  return JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;
}

/** Three-way merge: change only reviewed fields and refuse intervening edits to those fields. */
export function planBriefCorrection(change: BriefChange, input?: unknown) {
  const changes: string[] = [];
  const target = normalized(change.after.kind, change.after.content);
  if (input === undefined) {
    if (change.before) throw new Error(`Le document attendu ${change.after.id} est absent ; aucune écriture effectuée.`);
    return { content: target, changes: ['document'], create: true };
  }
  const current = normalized(change.after.kind, input);
  if (!change.before) {
    if (!isDeepStrictEqual(current, target)) throw new Error(`Un contenu différent occupe déjà ${change.after.id} ; aucune écriture effectuée.`);
    return { content: current, changes, create: false };
  }
  const baseline = normalized(change.before.kind, change.before.content);
  function merge(old: unknown, next: unknown, actual: unknown, field: string): unknown {
    if (isDeepStrictEqual(old, next) || isDeepStrictEqual(actual, next)) return structuredClone(actual);
    if (record(old) && record(next) && record(actual)) {
      const result = structuredClone(actual);
      for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
        const value = merge(old[key], next[key], actual[key], field ? `${field}.${key}` : key);
        if (value === undefined) delete result[key]; else result[key] = value;
      }
      return result;
    }
    if (!isDeepStrictEqual(actual, old)) throw new Error(`Modification éditoriale à préserver dans ${change.after.id}:${field} ; aucune écriture effectuée.`);
    changes.push(field);
    return structuredClone(next);
  }
  return { content: normalized(change.after.kind, merge(baseline, target, current, '')), changes, create: false };
}

export function publicationIncludesOnlyBrief(change: BriefChange, draft: unknown, published: unknown): boolean {
  try { return isDeepStrictEqual(planBriefCorrection(change, draft).content, planBriefCorrection(change, published).content); }
  catch { return false; }
}

/** Only this reviewed structural page may be added by this dated operator command. */
export async function importNewBriefPage(change: BriefChange, content: unknown): Promise<void> {
  const allowed = briefChanges.find(entry => !entry.before && entry.after.kind === 'page' && entry.after.content.slug === 'situations-sensibles');
  if (!allowed || change.before || change.after.id !== allowed.after.id || change.after.kind !== 'page' || !isDeepStrictEqual(normalized('page', content), normalized('page', allowed.after.content))) throw new Error('Cette migration structurelle est limitée à la nouvelle page Situations sensibles du cahier des charges.');
  // seedDocuments runs one transaction, refuses slug/ID collisions, preserves existing
  // content, and marks structural pages protected. It is never exposed by an admin API.
  const results = await seedDocuments([{ id: allowed.after.id, kind: 'page', content }], { publish: false });
  if (results[0]?.result !== 'created') throw new Error('La page a été créée depuis la simulation ; relancez le contrôle avant toute modification.');
}

async function main(): Promise<void> {
  try {
    try { loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url))); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const flags = process.argv.slice(2);
    const actorFlag = flags.find(flag => flag.startsWith('--actor-id='));
    if (flags.some(flag => !['--dry-run', '--apply', '--publish-local'].includes(flag) && flag !== actorFlag) || new Set(flags).size !== flags.length || (flags.includes('--apply') && flags.includes('--dry-run')) || (flags.includes('--publish-local') && !flags.includes('--apply'))) throw new Error('Options : --dry-run (défaut), ou --apply --actor-id=ID [--publish-local].');
    assertLocalTarget(process.env);
    const planned: Array<{ change: BriefChange; detail?: ContentDetail; plan: ReturnType<typeof planBriefCorrection>; publishable: boolean }> = [];
    // Complete every read and conflict check before the first mutation.
    for (const change of briefChanges) {
      let detail: ContentDetail | undefined;
      try { detail = await getContent(change.after.id); }
      catch (error) { if (!(error instanceof ContentError) || error.status !== 404) throw error; }
      if (detail && detail.kind !== change.after.kind) throw new Error('L’identité d’un document a changé ; aucune écriture effectuée.');
      if (detail?.status === 'archived') throw new Error('Un document a été archivé ; aucune écriture effectuée.');
      const plan = planBriefCorrection(change, detail?.content);
      let publishable = !detail;
      if (detail?.publishedRevisionId) {
        const result = await getPool().query<{ content: unknown }>('SELECT content FROM content_revisions WHERE id=$1 AND document_id=$2', [detail.publishedRevisionId, detail.id]);
        publishable = result.rows.length === 1 && publicationIncludesOnlyBrief(change, detail.content, result.rows[0]!.content);
      } else if (detail && !change.before && !plan.changes.length) publishable = true;
      planned.push({ change, detail, plan, publishable });
    }
    for (const row of planned) console.log(`${row.change.after.kind} ${row.change.after.id} : ${row.plan.create ? 'création' : `${row.plan.changes.length} champ(s)`} ; publication locale ${row.publishable ? 'possible' : 'refusée'}.`);
    if (!flags.includes('--apply')) { console.log('Simulation : aucune révision créée, aucune publication.'); return; }
    if (flags.includes('--publish-local') && planned.some(row => !row.publishable)) throw new Error('Un brouillon contient un autre changement inédit ; publication automatique refusée.');
    const actorId = actorFlag?.slice('--actor-id='.length);
    if (!actorId) throw new Error('Un compte administrateur local explicite est requis (--actor-id=ID).');
    const accounts = await getPool().query<EditorialActor>('SELECT id,name,role FROM auth_user WHERE id=$1 AND role=$2 AND email_verified=true AND disabled=false', [actorId, 'administrator']);
    if (accounts.rows.length !== 1) throw new Error('Le compte administrateur local est absent, suspendu ou non vérifié.');
    const actor = accounts.rows[0]!;
    let saved = 0; let published = 0;
    // Resolve structural insertion before modifying any other document. Do not open
    // createContent to pages: general admin mutations intentionally cannot create them.
    for (const { change, plan } of planned.filter(row => row.plan.create && row.change.after.kind === 'page')) {
      await importNewBriefPage(change, plan.content); saved++;
    }
    // Plan order creates people/statistics/categories before their published references.
    for (const { change, detail, plan } of planned) {
      let expectedVersion = detail?.version;
      if (plan.create && change.after.kind === 'page') expectedVersion = 1;
      else if (plan.create) { const created = await createContent(change.after.kind, plan.content, actor, { id: change.after.id }); expectedVersion = created.version; saved++; }
      else if (plan.changes.length && detail) { await saveContent(detail.id, plan.content, detail.version, actor); expectedVersion = detail.version + 1; saved++; }
      if (flags.includes('--publish-local') && expectedVersion !== undefined && (plan.create || plan.changes.length || detail?.hasUnpublishedChanges || !detail?.publishedRevisionId)) {
        // Do not replace this expected version with a reread: concurrent saves must fail.
        await publishContent(change.after.id, expectedVersion, actor); published++;
      }
    }
    console.log(`Recette locale uniquement : ${saved} révision(s) enregistrée(s), ${published} publication(s). Les documents historiques et leurs révisions sont conservés.`);
  } catch (error) {
    console.error(error instanceof ContentError ? `${error.code} : ${error.message}` : error instanceof Error && !('query' in error) && !('parameters' in error) && !('code' in error) ? error.message : 'Import interrompu ; aucun secret ni contenu privé journalisé.');
    process.exitCode = 1;
  } finally { await closeDatabase(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
