import type { APIRoute } from 'astro';
import { consumeRateLimit } from '../auth/rate-limit';
import { clientAddress } from '../client-address';
import { readBytes } from '../http';
import { beginOAuthAuthorization, exchangeOAuthToken, oauthOrigin, OAuthError, registerOAuthClient, revokeOAuthToken } from './oauth';

export function oauthResponse(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'WWW-Authenticate', 'X-Content-Type-Options': 'nosniff' } });
}
export function oauthFailure(error: unknown) { return oauthResponse({ error: error instanceof OAuthError ? error.code : 'server_error' }, error instanceof OAuthError ? error.status : 503); }
export const oauthEndpoint: APIRoute = async ({ request, params, clientAddress: address }) => {
  try {
    const action = params.action;
    if (new URL(request.url).origin !== oauthOrigin()) throw new OAuthError('invalid_request');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Cache-Control': 'no-store' } });
    if (!['authorize', 'token', 'register', 'revoke'].includes(action || '')) throw new OAuthError('invalid_request', 404);
    const ip = clientAddress(request, address);
    if (!await consumeRateLimit('oauth:' + action + ':' + ip, action === 'register' ? 20 : 120, action === 'register' ? 3600 : 60)) throw new OAuthError('temporarily_unavailable', 429);
    if (action === 'authorize' && request.method === 'GET') {
      if (request.url.length > 8192) throw new OAuthError('invalid_request');
      if (!await consumeRateLimit('oauth:authorize:global', 1000, 3600)) throw new OAuthError('temporarily_unavailable', 429);
      const result = await beginOAuthAuthorization(new URL(request.url).searchParams);
      return new Response(null, { status: 303, headers: { Location: result.redirectUrl, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' } });
    }
    if (request.method !== 'POST') throw new OAuthError('invalid_request', 405);
    const bytes = await readBytes(request, 16_384);
    if (action === 'register') {
      if (!request.headers.get('content-type')?.startsWith('application/json')) throw new OAuthError('invalid_request');
      if (!await consumeRateLimit('oauth:registration:global', 200, 86400)) throw new OAuthError('temporarily_unavailable', 429);
      let input: unknown; try { input = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new OAuthError('invalid_request'); }
      return oauthResponse(await registerOAuthClient(input), 201);
    }
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new OAuthError('invalid_request');
    const values = new URLSearchParams(new TextDecoder().decode(bytes));
    if (action === 'token') return oauthResponse(await exchangeOAuthToken(values, request.headers.get('authorization')));
    if (action === 'revoke') { await revokeOAuthToken(values, request.headers.get('authorization')); return oauthResponse({}); }
    throw new OAuthError('invalid_request');
  } catch (error) { return oauthFailure(error); }
};
