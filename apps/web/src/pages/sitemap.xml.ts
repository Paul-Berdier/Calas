import type {APIRoute} from 'astro';
import {getSiteContent} from '../lib/cms/client';
import {env,isProductionSite} from '../lib/environment';
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
export const GET:APIRoute=async(context)=>{
  if(!isProductionSite())return new Response('Sitemap désactivé dans cet environnement.',{status:404});
  const data=await getSiteContent(context,{publishedOnly:true});
  const paths=[...new Set(['/','/contact/','/reflexions/',...data.pages.map(p=>`/${p.slug}/`),...data.articles.map(a=>`/reflexions/${a.slug}/`)])];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path=>`<url><loc>${escape(new URL(path,env('SITE_URL')).href)}</loc></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml'}});
};
