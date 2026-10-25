import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config, root, runSanity } from './content-common.mjs';

const target = process.argv[2];
if (!target || target.startsWith('-')) throw new Error('Usage : pnpm content:export backups/contenu-AAAA-MM-JJ.tar.gz');
const archive = resolve(root, target);
if (existsSync(archive)) throw new Error('Le fichier existe déjà : choisissez une nouvelle archive pour préserver la sauvegarde.');
const cfg = config();
mkdirSync(dirname(archive), { recursive: true });
// The official exporter includes documents and assets by default. No --no-assets option.
runSanity(['dataset', 'export', cfg.dataset, archive], cfg);
console.log('Export terminé. Conservez cette archive dans un espace de sauvegarde privé et testez sa restauration.');
