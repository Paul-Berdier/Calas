/** Voluntary migration for the contact details and legal notices approved for launch. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { eq, sql } from '../apps/web/node_modules/drizzle-orm/index.js';
import { contactDescription, contactEmail, interventionArea, legalNotice, privacyNotice } from '../apps/web/src/lib/cms/legal';
import type { Page, Section, SiteContent } from '../apps/web/src/lib/cms/types';
import { closeDatabase, getDb } from '../apps/web/src/server/db';
import { user } from '../apps/web/src/server/db/auth-schema';
import { stableContentId } from '../apps/web/src/server/content/seed-plan';
import { revisePublishedStructure } from '../apps/web/src/server/content/repository';
import { parseContent, type EditorialActor } from '../apps/web/src/server/content/models';

const previous = JSON.parse(readFileSync(new URL('./editorial/brief-20261101-after.json', import.meta.url), 'utf8')) as SiteContent;
const pages = [legalNotice, privacyNotice];
const targets = ['settings', 'mentions-legales', 'confidentialite', 'contact'] as const;
type Target = typeof targets[number];

function replace<T>(before: T, after: T, actual: T, field: string): T {
  if (isDeepStrictEqual(actual, after) || isDeepStrictEqual(actual, before)) return after;
  throw new Error(`Modification éditoriale à préserver dans ${field}. Relire ce champ avant publication.`);
}

function correctedSections(before: Section[], after: Section[], actual: Section[], slug: string): Section[] {
  const result: Section[] = [];
  for (const desired of after) {
    const current = actual.find(item => item.key === desired.key);
    const old = before.find(item => item.key === desired.key);
    if (!current) {
      if (old) throw new Error(`La section ${slug}/${desired.key} a été retirée depuis le contenu de référence.`);
      result.push(structuredClone(desired));
    } else if (!old) {
      result.push(replace(undefined, desired, current, `${slug}/${desired.key}`)!);
    } else {
      // The draft may contain an editor's additional image, rich-text body, or navigation label.
      result.push({ ...current,
        title: replace(old.title, desired.title, current.title, `${slug}/${desired.key}/title`),
        text: replace(old.text, desired.text, current.text, `${slug}/${desired.key}/text`),
      });
    }
  }
  const untouched = actual.filter(item => !before.some(old => old.key === item.key) && !after.some(next => next.key === item.key));
  return [...result, ...untouched];
}

export function reviseContactPublication(target: Target, input: Record<string, unknown>): Record<string, unknown> {
  if (target === 'settings') return { ...input, email: replace(previous.settings.email, contactEmail, input.email, 'settings.email') };
  const page = parseContent('page', input) as unknown as Page;
  const before = previous.pages.find(item => item.slug === target)!;
  if (page.slug !== target) throw new Error('Identité de page inattendue.');
  if (target === 'contact') return {
    ...page,
    sections: correctedSections(before.sections, [interventionArea], page.sections, target),
    seo: { ...page.seo, description: replace(before.seo?.description, contactDescription, page.seo?.description, 'contact.seo.description') },
  };
  const after = pages.find(item => item.slug === target)!;
  return { ...page,
    intro: replace(before.intro, after.intro, page.intro, `${target}.intro`),
    sections: correctedSections(before.sections, after.sections, page.sections, target),
  };
}

export async function updateContactPublications(options: { apply: boolean; expectedDatabase: string; operatorId: string }) {
  if (!options.expectedDatabase || !options.operatorId) throw new Error('Base attendue et identifiant administrateur requis.');
  return getDb().transaction(async tx => {
    const result = await tx.execute(sql`select current_database() as database`);
    if (result.rows[0]?.database !== options.expectedDatabase) throw new Error('La base connectée diffère de la destination indiquée.');
    const [operator] = await tx.select().from(user).where(eq(user.id, options.operatorId));
    if (!operator || operator.role !== 'administrator' || operator.disabled || !operator.emailVerified) {
      throw new Error('Un administrateur actif et vérifié doit être désigné.');
    }
    const actor: EditorialActor = { id: operator.id, name: operator.name, role: 'administrator' };
    const changes = [];
    for (const target of targets) {
      const kind = target === 'settings' ? 'settings' : 'page';
      const id = stableContentId(kind, target === 'settings' ? 'site' : target);
      changes.push({ target, ...await revisePublishedStructure(tx, {
        id, kind, actor, apply: options.apply, edit: current => reviseContactPublication(target, current),
      }) });
    }
    return changes;
  });
}

async function main() {
  const flags = process.argv.slice(2);
  if (flags.length !== 1 || !['--dry-run', '--apply'].includes(flags[0]!)) throw new Error('Indiquer --dry-run ou --apply.');
  const results = await updateContactPublications({
    apply: flags[0] === '--apply',
    expectedDatabase: process.env.CALAS_TARGET_DATABASE ?? '',
    operatorId: process.env.CALAS_OPERATOR_ID ?? '',
  });
  console.log(JSON.stringify({ mode: flags[0], results }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error && !('code' in error || 'query' in error || 'parameters' in error) ? error.message : 'Opération interrompue. Les modifications de la transaction ont été annulées.');
    process.exitCode = 1;
  }).finally(closeDatabase);
}
