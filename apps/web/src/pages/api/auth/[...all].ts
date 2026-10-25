import type {APIRoute} from 'astro';
import {getAuth} from '../../../server/auth';
import {getSession,requireEditor} from '../../../server/auth/permissions';
import {assertSameOrigin,HttpError,jsonError,readBytes} from '../../../server/http';
import {clientAddress} from '../../../server/client-address';
import {consumeRateLimit} from '../../../server/auth/rate-limit';

const allowed=new Set(['/sign-in/email','/sign-out','/get-session','/verify-email','/send-verification-email','/request-password-reset','/reset-password','/change-password','/list-sessions','/revoke-session','/revoke-other-sessions','/revoke-sessions','/two-factor/enable','/two-factor/verify-totp','/two-factor/verify-backup-code','/two-factor/generate-backup-codes']);
const protectedActions=new Set(['/change-password','/list-sessions','/revoke-session','/revoke-other-sessions','/revoke-sessions','/two-factor/generate-backup-codes']);
export const ALL:APIRoute=async context=>{
  try{
    const path='/'+(context.params.all||'').replace(/^\/+|\/+$/g,'');
    const resetCallback=context.request.method==='GET'&&/^\/reset-password\/[A-Za-z0-9_-]{16,256}$/.test(path);
    if(!allowed.has(path)&&!resetCallback)throw new HttpError(404,'NOT_FOUND','Cette opération n’est pas disponible.');
    if(context.request.method!=='GET'&&context.request.method!=='POST')throw new HttpError(405,'METHOD','Méthode non autorisée.');
    if(context.request.method==='POST')assertSameOrigin(context.request);
    if(protectedActions.has(path))await requireEditor(context.request);
    if(path==='/two-factor/enable'){
      const session=await getSession(context.request);
      if(!session||!session.user.emailVerified||session.user.disabled)throw new HttpError(401,'UNAUTHENTICATED','Vérifiez votre adresse et reconnectez-vous.');
      if(session.user.twoFactorEnabled)throw new HttpError(409,'MFA_ACTIVE','La double authentification est déjà activée.');
    }
    const headers=new Headers(context.request.headers);
    // This header is always replaced at the edge of our own handler, never accepted from a browser.
    headers.delete('x-calas-client-ip');
    let address='127.0.0.1';
    try{address=context.clientAddress;}catch{/* Dev fallback shares a conservative local limit. */}
    headers.set('x-calas-client-ip',clientAddress(context.request,address));
    if(context.request.method==='POST'){
      const maximum=path==='/sign-in/email'||path.startsWith('/two-factor/')?8:path==='/request-password-reset'||path==='/send-verification-email'?4:30;
      const seconds=path==='/request-password-reset'||path==='/send-verification-email'?300:60;
      if(!await consumeRateLimit(`auth-edge:${headers.get('x-calas-client-ip')}:${path}`,maximum,seconds))throw new HttpError(429,'RATE_LIMIT','Trop de tentatives. Patientez avant de réessayer.');
    }
    let body:BodyInit|undefined;
    if(context.request.method==='POST'){
      const bytes=await readBytes(context.request,32_768);
      body=new TextDecoder().decode(bytes);
      if(path.startsWith('/two-factor/')){
        let parsed:Record<string,unknown>;try{parsed=JSON.parse(body as string);}catch{throw new HttpError(400,'INVALID_JSON','La saisie est illisible.');}
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new HttpError(400,'INVALID_JSON','La saisie est illisible.');
        parsed.trustDevice=false;if(path==='/two-factor/enable')parsed.method='totp';body=JSON.stringify(parsed);headers.delete('content-length');
      }
    }
    const request=new Request(new URL(`/api/auth${path}${context.url.search}`,process.env.BETTER_AUTH_URL||context.url.origin),{method:context.request.method,headers,body});
    const response=await getAuth().handler(request);
    response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
  }catch(error){return jsonError(error);}
};
