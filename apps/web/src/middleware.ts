import {defineMiddleware} from 'astro:middleware';
import {ContentUnavailableError} from './lib/cms/client';
import {env,isProductionSite} from './lib/environment';
import {isPreview} from './lib/cms/preview';
export const onRequest=defineMiddleware(async(context,next)=>{
  let response:Response;
  try {response=await next();}
  catch(error){
    if(!(error instanceof ContentUnavailableError)) throw error;
    response=new Response('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Un instant, s’il vous plaît — Calas Conseil</title><body style="margin:0;padding:12vh 8vw;background:#f7f2ea;color:#14213a;font:22px/1.5 Georgia,serif"><main style="max-width:650px;margin:auto"><p>CALAS CONSEIL</p><h1>Le site est momentanément indisponible.</h1><p>Merci de réessayer dans quelques instants. Nous vous remercions de votre patience.</p><a href="/">Réessayer</a></main></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Retry-After':'60'}});
  }
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('Referrer-Policy',isPreview(context.cookies)||context.url.pathname.startsWith('/api/preview/')?'no-referrer':'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(!isProductionSite()||isPreview(context.cookies))response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
  if(isPreview(context.cookies)||context.url.pathname.startsWith('/contact')||context.url.pathname.startsWith('/api/'))response.headers.set('Cache-Control','private, no-store');
  const studio=env('PUBLIC_SANITY_STUDIO_URL');
  let frame="'self'";try{if(studio)frame+=` ${new URL(studio).origin}`;}catch{/* invalid config remains self-only */}
  response.headers.set('Content-Security-Policy',`frame-ancestors ${frame}; object-src 'none'; base-uri 'self'`);
  if(isProductionSite())response.headers.set('Strict-Transport-Security','max-age=31536000');
  return response;
});
