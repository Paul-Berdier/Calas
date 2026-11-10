import { defineConfig } from 'drizzle-kit';
import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
const root = existsSync('apps/web/package.json') ? process.cwd() : resolve(process.cwd(), '../..');
try { loadEnvFile(resolve(root, 'apps/web/.env')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }

export default defineConfig({
  dialect: 'postgresql',
  schema: ['apps/web/src/server/db/schema.ts', 'apps/web/src/server/db/auth-schema.ts', 'apps/web/src/server/db/contact-schema.ts', 'apps/web/src/server/media/schema.ts'].map(path => resolve(root, path).replaceAll('\\', '/')),
  out: relative(process.cwd(), resolve(root, 'drizzle')).replaceAll('\\', '/'),
  dbCredentials: { url: process.env.DATABASE_URL || '' },
  strict: true,
  verbose: false,
});
