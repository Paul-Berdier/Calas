import type {APIRoute} from 'astro';
import {env,isProductionSite} from '../lib/environment';
export const GET:APIRoute=()=>new Response(isProductionSite()?`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${env('SITE_URL')}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain'}});
