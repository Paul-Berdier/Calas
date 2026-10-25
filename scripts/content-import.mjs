import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config, root, runSanity, createClient } from './content-common.mjs';

const source = process.argv[2];
if (!source || source.startsWith('-')) throw new Error('Usage : pnpm content:import backups/contenu-AAAA-MM-JJ.tar.gz');
const archive = resolve(root, source);
if (!existsSync(archive)) throw new Error('Archive introuvable.');
const cfg = config({ write: true });
const client = createClient(cfg);
const count = await client.fetch('count(*[!(_id in path("_.**"))])');
if (count > 0) throw new Error('Restauration refusée : utilisez un dataset de test vide pour éviter d’écraser des contenus.');
// No --replace: existing contents cannot be silently overwritten.
runSanity(['dataset', 'import', archive, '--dataset', cfg.dataset], cfg);
console.log('Restauration terminée dans le dataset de test. Vérifiez documents, médias, liens et brouillons avant toute bascule.');
