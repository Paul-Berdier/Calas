import {defineConfig} from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@tailwindcss/vite';
import {loadEnvFile} from 'node:process';
try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const siteUrl=new URL(process.env.SITE_URL || 'http://localhost:4321');
const local=siteUrl.hostname==='localhost'||siteUrl.hostname==='127.0.0.1';
export default defineConfig({
  logger:{entrypoint:new URL('./src/server/logger.mjs',import.meta.url)},
  output:'server', adapter:node({mode:'standalone',bodySizeLimit:23_068_672}),
  site:process.env.SITE_URL || 'http://localhost:4321',
  // Public links retain their existing slash; Better Auth must also accept its slashless API URLs.
  trailingSlash:'ignore', devToolbar:{enabled:false},
  security:{allowedDomains:local?[{hostname:'localhost',protocol:'http'},{hostname:'127.0.0.1',protocol:'http'}]:[{hostname:siteUrl.hostname,protocol:siteUrl.protocol.replace(':',''),port:siteUrl.port||'443'}]},
  integrations:[react()],
  vite:{plugins:[tailwind()],worker:{format:'es'},server:{allowedHosts:['localhost','127.0.0.1']}}
});
