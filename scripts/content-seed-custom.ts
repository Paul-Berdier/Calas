import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { demoContent } from '../apps/web/src/lib/cms/demo';
import { closeDatabase } from '../apps/web/src/server/db';
import { prepareSeedPlan } from '../apps/web/src/server/content/seed-plan';
import { seedDocuments } from '../apps/web/src/server/content/repository';

try { loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url))); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const flags = process.argv.slice(2);
const allowed = ['--dry-run', '--apply', '--publish-initial'];
try {
  if (flags.some(flag => !allowed.includes(flag)) || new Set(flags).size !== flags.length) throw new Error('Options : --dry-run ou --apply, avec --publish-initial pour la recette explicitement publiée.');
  if (flags.includes('--dry-run') && flags.includes('--apply')) throw new Error('Choisissez --dry-run ou --apply.');
  const plan = prepareSeedPlan(demoContent);
  console.log(`Contenu initial : ${plan.entries.length} ressources, ${plan.warnings.length} avertissement(s).`);
  if (!flags.includes('--apply')) {
    for (const entry of plan.entries) console.log(`À examiner : ${entry.kind} ${entry.id}`);
    console.log('Simulation : aucun accès à PostgreSQL et aucun contenu modifié. Utiliser --apply pour importer les brouillons absents.');
  } else {
    if (!['development', 'staging', 'test'].includes(process.env.SITE_ENV || '')) throw new Error('SITE_ENV doit désigner development, staging ou test.');
    if (plan.warnings.length) throw new Error('Le contenu source contient des éléments non reconnus : corriger le rapport avant import.');
    const results = await seedDocuments(plan.entries, { publish: flags.includes('--publish-initial') });
    for (const entry of results) console.log(`${entry.result} : ${entry.kind} ${entry.id}`);
    console.log('Les ressources existantes ont été conservées sans modification.');
  }
  for (const warning of plan.warnings) console.log(`Avertissement : ${warning}`);
} catch (error) {
  console.error(error instanceof Error && !('query' in error) && !('parameters' in error) ? error.message : 'L’import PostgreSQL a échoué. Aucun secret ni contenu privé n’a été journalisé.');
  process.exitCode = 1;
} finally { await closeDatabase(); }
