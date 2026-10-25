import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'calaslocal',
    dataset: process.env.SANITY_STUDIO_DATASET || 'staging',
  },
  studioHost: process.env.SANITY_STUDIO_HOSTNAME,
  vite: config => ({ ...config, worker: { ...config.worker, format: 'es' } }),
  typegen: { path: '../web/src/lib/cms/queries.ts', schema: './schema.json', generates: '../web/src/lib/cms/sanity.generated.ts' },
});
