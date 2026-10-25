import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, stat } from 'node:fs/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'apps/web/public/_preview');
await mkdir(output, { recursive: true });

// An independent dependency graph prevents Astro from hoisting the editor's CSS
// into public pages. These assets contain no data, credentials or server code.
await build({
  absWorkingDir: root,
  entryPoints: [resolve(root, 'apps/web/src/lib/cms/preview-client.ts')],
  outfile: resolve(output, 'editor.js'),
  bundle: true,
  splitting: false,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  sourcemap: false,
  legalComments: 'linked',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.svg': 'dataurl', '.png': 'dataurl' },
  logLevel: 'warning',
});
const [js, css] = await Promise.all([stat(resolve(output, 'editor.js')), stat(resolve(output, 'editor.css'))]);
console.log(`Édition privée préparée : ${Math.ceil(js.size / 1024)} Kio JS, ${Math.ceil(css.size / 1024)} Kio CSS (aucun chargement sur le site public).`);
