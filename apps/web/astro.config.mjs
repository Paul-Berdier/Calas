import {defineConfig} from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sanity from '@sanity/astro';
import {loadEnvFile} from 'node:process';
try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.PUBLIC_SANITY_DATASET || 'staging';
const siteUrl=new URL(process.env.SITE_URL || 'http://localhost:4321');
const local=siteUrl.hostname==='localhost'||siteUrl.hostname==='127.0.0.1';
export default defineConfig({
  output:'server', adapter:node({mode:'standalone',bodySizeLimit:131072}),
  site:process.env.SITE_URL || 'http://localhost:4321',
  trailingSlash:'always', devToolbar:{enabled:false},
  security:{allowedDomains:local?[{hostname:'localhost',protocol:'http'},{hostname:'127.0.0.1',protocol:'http'}]:[{hostname:siteUrl.hostname,protocol:siteUrl.protocol.replace(':',''),port:siteUrl.port||'443'}]},
  integrations:[react(), ...(projectId ? [sanity({projectId,dataset,useCdn:false,apiVersion:'2026-10-25',studioUrl:process.env.PUBLIC_SANITY_STUDIO_URL})] : [])],
  image:{domains:['cdn.sanity.io']},
  vite:{server:{allowedHosts:['localhost','127.0.0.1']}}
});
