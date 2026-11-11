import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { getPool } from '../db';
import { hasRequiredAuthentication } from '../auth/access-policy';
import type { Actor } from '../auth/permissions';
import { HttpError } from '../http';
import { agentScopes, type AgentAccess, type AgentScope } from './access';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const opaque = () => randomBytes(32).toString('base64url');
const same = (a: string, b: string) => timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
export class OAuthError extends Error { constructor(public code: string, public status = 400) { super(code); } }
const invalid = () => new OAuthError('invalid_grant');
export function oauthOrigin() {
  const url = new URL(process.env.SITE_URL || process.env.BETTER_AUTH_URL || 'http://localhost:4321');
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new OAuthError('server_error', 503);
  return url.origin;
}
export function mcpResource() { return oauthOrigin() + '/mcp/'; }
export function oauthMetadata() {
  const origin = oauthOrigin();
  return { issuer: origin, authorization_endpoint: origin + '/oauth/authorize/', token_endpoint: origin + '/oauth/token/',
    registration_endpoint: origin + '/oauth/register/', revocation_endpoint: origin + '/oauth/revoke/',
    response_types_supported: ['code'], response_modes_supported: ['query'], grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'], scopes_supported: agentScopes,
    authorization_response_iss_parameter_supported: true, client_id_metadata_document_supported: false };
}
export function resourceMetadata() { return { resource: mcpResource(), authorization_servers: [oauthOrigin()], scopes_supported: agentScopes, bearer_methods_supported: ['header'], resource_name: 'Administration Calas Conseil' }; }

function redirectAllowed(value: string) {
  try { const url = new URL(value); return value.length <= 2048 && !/[\u0000-\u0020\u007f]/.test(value) && !url.username && !url.password && !url.hash
    && (url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)); } catch { return false; }
}
export const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(100).default('Application IA'),
  redirect_uris: z.array(z.string().refine(redirectAllowed)).min(1).max(10),
  token_endpoint_auth_method: z.enum(['none', 'client_secret_post', 'client_secret_basic']).default('none'),
  grant_types: z.array(z.enum(['authorization_code', 'refresh_token'])).min(1).max(2).default(['authorization_code', 'refresh_token']),
  response_types: z.array(z.literal('code')).length(1).default(['code']),
}).strip();
export async function registerOAuthClient(input: unknown) {
  const parsed = registrationSchema.safeParse(input); if (!parsed.success) throw new OAuthError('invalid_client_metadata');
  const value = parsed.data, id = 'calas-client-' + randomUUID();
  const secret = value.token_endpoint_auth_method === 'none' ? undefined : opaque();
  await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(64236017)');
    await client.query("DELETE FROM oauth_requests WHERE expires_at<now()-interval '1 day'");
    await client.query("DELETE FROM oauth_tokens WHERE expires_at<now()-interval '1 day'");
    await client.query("DELETE FROM oauth_grants WHERE expires_at<now()-interval '30 days'");
    const count = Number((await client.query('SELECT count(*) FROM oauth_clients')).rows[0].count);
    if (count >= 10000) throw new OAuthError('temporarily_unavailable', 429);
    await client.query('INSERT INTO oauth_clients(id,name,redirect_uris,auth_method,secret_hash) VALUES($1,$2,$3,$4,$5)', [id, value.client_name, value.redirect_uris, value.token_endpoint_auth_method, secret ? hash(secret) : null]);
  });
  return { ...value, client_id: id, client_id_issued_at: Math.floor(Date.now() / 1000), ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}) };
}
function requestedScopes(input: string | null) {
  const values = (input || agentScopes.join(' ')).split(' ').filter(Boolean);
  if (!values.includes('read') || values.length > 6 || new Set(values).size !== values.length || values.some(value => !agentScopes.includes(value as AgentScope))) throw new OAuthError('invalid_scope');
  return values as AgentScope[];
}
function singleParams(params: URLSearchParams) { for (const key of new Set(params.keys())) if (params.getAll(key).length !== 1) throw new OAuthError('invalid_request'); }
export async function beginOAuthAuthorization(params: URLSearchParams) {
  singleParams(params);
  const clientId = params.get('client_id') || '', redirectUri = params.get('redirect_uri') || '';
  const client = (await getPool().query('SELECT id,redirect_uris FROM oauth_clients WHERE id=$1', [clientId])).rows[0];
  if (!client || !client.redirect_uris.includes(redirectUri)) throw new OAuthError('invalid_request');
  const challenge = params.get('code_challenge') || '', state = params.get('state') || '';
  if (params.get('response_type') !== 'code' || params.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)
    || !state || state.length > 2048 || params.get('resource') !== mcpResource()) throw new OAuthError('invalid_request');
  const scopes = requestedScopes(params.get('scope')), id = opaque();
  await getPool().query("DELETE FROM oauth_requests WHERE expires_at<now()-interval '1 day'");
  await getPool().query("INSERT INTO oauth_requests(id,client_id,redirect_uri,state,challenge,resource,scopes,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '10 minutes')", [id, clientId, redirectUri, state, challenge, mcpResource(), scopes]);
  return { requestId: id, redirectUrl: '/admin/connexion-ia/?request=' + id };
}
async function transaction<T>(work: (client: PoolClient) => Promise<T>) { const client = await getPool().connect(); try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); } }

async function liveSession(client: Pick<PoolClient, 'query'>, sessionId: string, userId?: string) {
  const row = (await client.query(`SELECT u.id,u.name,u.email,u.role,u.email_verified AS "emailVerified",u.disabled,u.two_factor_enabled AS "twoFactorEnabled",s.mfa_verified AS "mfaVerified",s.expires_at AS "sessionExpiresAt" FROM auth_session s JOIN auth_user u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>now()`, [sessionId])).rows[0];
  if (!row || userId && row.id !== userId || row.disabled || !row.emailVerified || !['administrator', 'editor'].includes(row.role)
    || !hasRequiredAuthentication({ user: row, session: row })) throw invalid();
  return row as Actor & { sessionExpiresAt: Date };
}
export async function readOAuthRequest(id: string, actor: Actor, sessionId: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) throw new HttpError(404, 'NOT_FOUND', 'Cette demande est introuvable.');
  return transaction(async client => {
    const current = await liveSession(client, sessionId, actor.id);
    const row = (await client.query('SELECT r.*,c.name AS client_name FROM oauth_requests r JOIN oauth_clients c ON c.id=r.client_id WHERE r.id=$1 AND r.expires_at>now() AND r.used_at IS NULL FOR UPDATE OF r', [id])).rows[0];
    if (!row || row.session_id && row.session_id !== sessionId) throw new HttpError(404, 'NOT_FOUND', 'Cette demande a expiré ou appartient à une autre session.');
    await client.query('UPDATE oauth_requests SET session_id=$2 WHERE id=$1', [id, sessionId]);
    return { clientName: row.client_name, redirectHost: new URL(row.redirect_uri).host, requestedScopes: row.scopes,
      allowedScopes: row.scopes.filter((scope: string) => scope !== 'users' || current.role === 'administrator'), expiresAt: row.expires_at };
  });
}
export const decisionSchema = z.object({ approve: z.boolean(), scopes: z.array(z.enum(agentScopes)).max(6).default([]) }).strict();
export async function decideOAuthRequest(id: string, actor: Actor, sessionId: string, input: z.infer<typeof decisionSchema>) {
  return transaction(async client => {
    const current = await liveSession(client, sessionId, actor.id);
    const row = (await client.query('SELECT * FROM oauth_requests WHERE id=$1 AND session_id=$2 AND expires_at>now() AND used_at IS NULL FOR UPDATE', [id, sessionId])).rows[0];
    if (!row) throw new HttpError(409, 'OAUTH_EXPIRED', 'Cette demande a expiré. Recommencez la connexion depuis votre application IA.');
    const redirect = new URL(row.redirect_uri); redirect.searchParams.set('state', row.state); redirect.searchParams.set('iss', oauthOrigin());
    if (input.approve) {
      if (!input.scopes.includes('read')) throw new OAuthError('invalid_scope');
      const scopes = requestedScopes(input.scopes.join(' '));
      if (scopes.some(scope => !row.scopes.includes(scope)) || scopes.includes('users') && current.role !== 'administrator') throw new OAuthError('invalid_scope');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['oauth-grants:' + actor.id]);
      const active = Number((await client.query('SELECT count(*) FROM oauth_grants WHERE user_id=$1 AND expires_at>now() AND revoked_at IS NULL', [actor.id])).rows[0].count);
      if (active >= 20) throw new HttpError(409, 'OAUTH_LIMIT', 'Révoquez une ancienne connexion IA avant d’en autoriser une nouvelle.');
      const grantId = randomUUID(), code = opaque(), createdAt = new Date();
      const expiresAt = new Date(Math.min(current.sessionExpiresAt.getTime(), createdAt.getTime() + 8 * 60 * 60_000));
      await client.query('INSERT INTO oauth_grants(id,client_id,user_id,session_id,resource,scopes,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [grantId, row.client_id, actor.id, sessionId, row.resource, scopes, createdAt, expiresAt]);
      await client.query("INSERT INTO oauth_codes(hash,grant_id,challenge,redirect_uri,expires_at) VALUES($1,$2,$3,$4,now()+interval '2 minutes')", [hash(code), grantId, row.challenge, row.redirect_uri]);
      await client.query("INSERT INTO security_events(id,actor_id,action) VALUES($1,$2,'agent.oauth.authorized')", [randomUUID(), actor.id]);
      redirect.searchParams.set('code', code);
    } else redirect.searchParams.set('error', 'access_denied');
    await client.query('UPDATE oauth_requests SET used_at=now() WHERE id=$1', [id]);
    return { redirectUrl: redirect.href };
  });
}

async function authenticateClient(params: URLSearchParams, authorization?: string | null) {
  singleParams(params);
  let id = params.get('client_id') || '', secret = params.get('client_secret'), method = secret ? 'client_secret_post' : 'none';
  if (authorization) {
    if (!authorization.startsWith('Basic ') || secret) throw new OAuthError('invalid_client', 401);
    let credentials: string; try { credentials = Buffer.from(authorization.slice(6), 'base64').toString('utf8'); } catch { throw new OAuthError('invalid_client', 401); }
    const index = credentials.indexOf(':'); if (index < 1) throw new OAuthError('invalid_client', 401);
    let basicId: string;
    try { basicId = decodeURIComponent(credentials.slice(0, index)); secret = decodeURIComponent(credentials.slice(index + 1)); } catch { throw new OAuthError('invalid_client', 401); }
    if (id && id !== basicId) throw new OAuthError('invalid_client', 401); id = basicId; method = 'client_secret_basic';
  }
  const client = (await getPool().query('SELECT * FROM oauth_clients WHERE id=$1', [id])).rows[0];
  if (!client || client.auth_method !== method || method !== 'none' && (!secret || !same(client.secret_hash, hash(secret)))) throw new OAuthError('invalid_client', 401);
  return client;
}
async function mintTokens(client: PoolClient, grant: { id: string; expires_at: Date; scopes: string[] }) {
  const access = 'co_access_' + opaque(), refresh = 'co_refresh_' + opaque(), now = Date.now();
  const expires = new Date(Math.min(grant.expires_at.getTime(), now + 15 * 60_000));
  await client.query('INSERT INTO oauth_tokens(hash,grant_id,kind,expires_at) VALUES($1,$2,\'access\',$3),($4,$2,\'refresh\',$5)', [hash(access), grant.id, expires, hash(refresh), grant.expires_at]);
  return { access_token: access, token_type: 'Bearer', expires_in: Math.max(1, Math.floor((expires.getTime() - now) / 1000)), refresh_token: refresh, scope: grant.scopes.join(' ') };
}
export async function exchangeOAuthToken(params: URLSearchParams, authorization?: string | null) {
  const clientInfo = await authenticateClient(params, authorization), grantType = params.get('grant_type');
  if (grantType !== 'authorization_code' && grantType !== 'refresh_token') throw new OAuthError('unsupported_grant_type');
  const value = params.get(grantType === 'authorization_code' ? 'code' : 'refresh_token') || '';
  if (value.length > 100 || !value) throw invalid();
  const outcome = await transaction(async client => {
    const table = grantType === 'authorization_code' ? 'oauth_codes' : 'oauth_tokens';
    const credential = (await client.query(`SELECT * FROM ${table} WHERE hash=$1 FOR UPDATE`, [hash(value)])).rows[0];
    if (!credential || grantType === 'refresh_token' && credential.kind !== 'refresh') return { error: true } as const;
    const grant = (await client.query('SELECT * FROM oauth_grants WHERE id=$1 FOR UPDATE', [credential.grant_id])).rows[0];
    if (!grant || grant.client_id !== clientInfo.id || grant.revoked_at || grant.expires_at.getTime() <= Date.now()) return { error: true } as const;
    await liveSession(client, grant.session_id, grant.user_id);
    const resource = params.get('resource');
    if ((resource || (grantType === 'refresh_token' ? grant.resource : '')) !== grant.resource || grant.resource !== mcpResource()) return { error: true } as const;
    if (grantType === 'authorization_code') {
      const verifier = params.get('code_verifier') || '';
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !same(createHash('sha256').update(verifier).digest('base64url'), credential.challenge) || params.get('redirect_uri') !== credential.redirect_uri) return { error: true } as const;
    }
    if (params.has('scope') && params.get('scope') !== grant.scopes.join(' ')) return { error: true } as const;
    // An intercepted used authorization code is not proof of a replay by its PKCE owner.
    if (credential.used_at) { await client.query('UPDATE oauth_grants SET revoked_at=now() WHERE id=$1', [grant.id]); return { error: true } as const; }
    if (credential.expires_at.getTime() <= Date.now()) return { error: true } as const;
    await client.query(`UPDATE ${table} SET used_at=now() WHERE hash=$1`, [hash(value)]);
    return { tokens: await mintTokens(client, grant) } as const;
  });
  if ('error' in outcome) throw invalid(); return outcome.tokens;
}
export async function revokeOAuthToken(params: URLSearchParams, authorization?: string | null) {
  const client = await authenticateClient(params, authorization), token = params.get('token') || '';
  if (token.length <= 100) await transaction(async connection => {
    const result = await connection.query('UPDATE oauth_grants SET revoked_at=now() WHERE client_id=$1 AND revoked_at IS NULL AND id IN(SELECT grant_id FROM oauth_tokens WHERE hash=$2) RETURNING user_id', [client.id, hash(token)]);
    if (result.rowCount) await connection.query("INSERT INTO security_events(id,actor_id,action) VALUES($1,$2,'agent.oauth.revoked')", [randomUUID(), result.rows[0].user_id]);
  });
}
export async function requireOAuthAccess(request: Request): Promise<AgentAccess> {
  const token = request.headers.get('authorization') || '';
  if (!/^Bearer co_access_[A-Za-z0-9_-]{43}$/.test(token)) throw new OAuthError('invalid_token', 401);
  const grant = (await getPool().query(`SELECT g.* FROM oauth_tokens t JOIN oauth_grants g ON g.id=t.grant_id WHERE t.hash=$1 AND t.kind='access' AND t.expires_at>now() AND g.expires_at>now() AND g.revoked_at IS NULL`, [hash(token.slice(7))])).rows[0];
  if (!grant || grant.resource !== mcpResource()) throw new OAuthError('invalid_token', 401);
  let actor: Actor; try { actor = await liveSession(getPool(), grant.session_id, grant.user_id); } catch { throw new OAuthError('invalid_token', 401); }
  return { actor, tokenId: grant.id, scopes: grant.scopes, transport: 'oauth' };
}
export async function listOAuthConnections(actor: Actor) {
  return (await getPool().query('SELECT g.id,c.name AS "clientName",g.scopes,g.created_at AS "createdAt",g.expires_at AS "expiresAt",g.last_used_at AS "lastUsedAt",g.revoked_at AS "revokedAt" FROM oauth_grants g JOIN oauth_clients c ON c.id=g.client_id WHERE g.user_id=$1 ORDER BY g.created_at DESC LIMIT 50', [actor.id])).rows;
}
export async function revokeOAuthConnection(actor: Actor, id: string) {
  await transaction(async client => {
    const result = await client.query('UPDATE oauth_grants SET revoked_at=now() WHERE id=$1 AND user_id=$2', [id, actor.id]);
    if (!result.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Cette connexion est introuvable.');
    await client.query("INSERT INTO security_events(id,actor_id,action) VALUES($1,$2,'agent.oauth.revoked')", [randomUUID(), actor.id]);
  });
  return { revoked: true };
}
