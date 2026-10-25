import {defineMiddleware} from 'astro:middleware';
import {randomBytes} from 'node:crypto';
import {ContentUnavailableError} from './lib/cms/client';
import {isProductionSite} from './lib/environment';
import {isPreview} from './lib/cms/preview';
export const onRequest=defineMiddleware(async(context,next)=>{
  let response:Response;
  const path=context.url.pathname;
  const privateRoute=path.startsWith('/admin')||path.startsWith('/api/')||path.startsWith('/media/');
  try{
    context.locals.cmsPreview=await isPreview(context);
    response=await next();
  }catch(error){
    if(!(error instanceof ContentUnavailableError))throw error;
    response=new Response('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Un instant, s’il vous plaît — Calas Conseil</title><body style="margin:0;padding:12vh 8vw;background:#f7f2ea;color:#14213a;font:22px/1.5 Georgia,serif"><main style="max-width:650px;margin:auto"><p>CALAS CONSEIL</p><h1>Le site est momentanément indisponible.</h1><p>Merci de réessayer dans quelques instants. Nous vous remercions de votre patience.</p><a href="/">Réessayer</a></main></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Retry-After':'60'}});
  }
  const headers=new Headers(response.headers);
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy',privateRoute||context.locals.cmsPreview?'no-referrer':'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(!isProductionSite()||privateRoute||context.locals.cmsPreview)headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
  if(context.locals.cmsPreview||context.url.searchParams.has('preview')||privateRoute||path.startsWith('/contact'))headers.set('Cache-Control','private, no-store');
  if(isProductionSite())headers.set('Strict-Transport-Security','max-age=31536000');
  if(headers.get('content-type')?.includes('text/html')){
    const nonce=randomBytes(18).toString('base64');
    const html=(await response.text()).replace(/<script(?=[\s>])/gi,`<script nonce="${nonce}"`);
    const development=import.meta.env.DEV;
    headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self' 'nonce-${nonce}'${privateRoute?" 'wasm-unsafe-eval'":''}${development?" 'unsafe-eval'":''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'${development?' ws://localhost:* ws://127.0.0.1:*':''}; worker-src 'self' blob:; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`);
    headers.delete('content-length');return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }
  // Preserve the stricter sandbox on media responses.
  if(!headers.has('Content-Security-Policy'))headers.set('Content-Security-Policy',"frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
});
