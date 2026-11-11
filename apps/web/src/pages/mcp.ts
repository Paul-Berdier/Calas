import type { APIRoute } from 'astro';
import { consumeRateLimit } from '../server/auth/rate-limit';
import { clientAddress } from '../server/client-address';
import { handleRemoteMcp } from '../server/agent/remote';
import { oauthOrigin, OAuthError, requireOAuthAccess } from '../server/agent/oauth';
import { oauthFailure } from '../server/agent/oauth-http';
import { agentScopes } from '../server/agent/access';

export const ALL: APIRoute = async ({ request, clientAddress: address }) => {
  try {
    const origin = oauthOrigin(), requestOrigin = request.headers.get('origin');
    if (new URL(request.url).origin !== origin || requestOrigin && ![origin, 'https://chatgpt.com', 'https://claude.ai'].includes(requestOrigin)) throw new OAuthError('invalid_request', 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': requestOrigin || origin, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id', 'Cache-Control': 'no-store' } });
    if (!await consumeRateLimit('mcp:ip:' + clientAddress(request, address), 120, 60)) throw new OAuthError('temporarily_unavailable', 429);
    const access = await requireOAuthAccess(request);
    if (!await consumeRateLimit('mcp:grant:' + access.tokenId, 60, 60)) throw new OAuthError('temporarily_unavailable', 429);
    const response = await handleRemoteMcp(request, access);
    const headers = new Headers(response.headers); headers.set('Cache-Control', 'private, no-store'); headers.set('X-Robots-Tag', 'noindex, nofollow');
    if (requestOrigin) { headers.set('Access-Control-Allow-Origin', requestOrigin); headers.set('Access-Control-Expose-Headers', 'WWW-Authenticate, MCP-Protocol-Version'); headers.set('Vary', 'Origin'); }
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    const response = oauthFailure(error);
    if (error instanceof OAuthError && error.status === 401) response.headers.set('WWW-Authenticate', `Bearer resource_metadata="${oauthOrigin()}/.well-known/oauth-protected-resource/mcp", scope="${agentScopes.join(' ')}", error="invalid_token"`);
    return response;
  }
};
