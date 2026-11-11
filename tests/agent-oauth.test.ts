import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closeDatabase, getPool } from '../apps/web/src/server/db';
import { migrateDatabase } from '../apps/web/src/server/db/migrate';
import { beginOAuthAuthorization, decideOAuthRequest, exchangeOAuthToken, listOAuthConnections, mcpResource, OAuthError, oauthMetadata, readOAuthRequest, registerOAuthClient, requireOAuthAccess, revokeOAuthConnection, revokeOAuthToken } from '../apps/web/src/server/agent/oauth';
import { handleRemoteMcp } from '../apps/web/src/server/agent/remote';
import { HttpError } from '../apps/web/src/server/http';
import type { Actor } from '../apps/web/src/server/auth/permissions';

try { loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url))); } catch { /* CI supplies local environment. */ }
const original = process.env.DATABASE_URL;
const local = original && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(original).hostname);
const actor: Actor = { id: 'oauth-test-admin', name: 'Admin OAuth', email: 'oauth@example.test', role: 'administrator' };
const codeError = (code: string) => (error: unknown) => error instanceof OAuthError && error.code === code;
const requestWith = (token: string) => new Request(mcpResource(), { headers: { authorization: 'Bearer ' + token } });
const requireSdk = createRequire(new URL('../apps/mcp/package.json', import.meta.url));

test('OAuth distant : autorisation PKCE, révocation et protocole Streamable HTTP réel', { skip: !local, timeout: 120_000 }, async suite => {
  const database = 'calas_oauth_test_' + randomUUID().replaceAll('-', '');
  await getPool().query(`CREATE DATABASE "${database}"`); await closeDatabase();
  const isolated = new URL(original!); isolated.pathname = '/' + database;
  process.env.DATABASE_URL = isolated.href; process.env.SITE_ENV = 'test';
  const http = createServer(async (incoming, outgoing) => {
    try {
      const parts = []; for await (const part of incoming) parts.push(part);
      const body = Buffer.concat(parts);
      const request = new Request(mcpResource(), { method: incoming.method, headers: incoming.headers as Record<string, string>, ...(body.length ? { body } : {}) });
      const access = await requireOAuthAccess(request);
      const response = await handleRemoteMcp(request, access);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) for await (const chunk of response.body) outgoing.write(chunk);
      outgoing.end();
    } catch (error) { outgoing.writeHead(error instanceof OAuthError ? error.status : 500, { 'content-type': 'application/json' }); outgoing.end('{}'); }
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address(); assert(address && typeof address !== 'string');
  process.env.SITE_URL = `http://127.0.0.1:${address.port}`;
  const sessionId = 'oauth-session';
  try {
    await migrateDatabase(fileURLToPath(new URL('../drizzle', import.meta.url)));
    await getPool().query('INSERT INTO auth_user(id,name,email,email_verified,role,two_factor_enabled) VALUES($1,$2,$3,true,$4,true)', [actor.id, actor.name, actor.email, actor.role]);
    for (const id of [sessionId, 'other-session']) await getPool().query("INSERT INTO auth_session(id,user_id,token,expires_at,mfa_verified) VALUES($1,$2,$1,now()+interval '24 hours',true)", [id, actor.id]);
    const client = await registerOAuthClient({ client_name: 'Client SDK recette', redirect_uris: ['https://client.example/callback'], token_endpoint_auth_method: 'none' });
    const prepare = async (scopes = 'read draft') => {
      const verifier = randomBytes(32).toString('base64url'), state = randomUUID();
      const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: 'code', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state, resource: mcpResource(), scope: scopes });
      const pending = await beginOAuthAuthorization(query);
      return { pending, verifier, query, state };
    };
    const grant = async (scopes = 'read draft') => {
      const prepared = await prepare(scopes);
      await readOAuthRequest(prepared.pending.requestId, actor, sessionId);
      const decision = await decideOAuthRequest(prepared.pending.requestId, actor, sessionId, { approve: true, scopes: scopes.split(' ') as ('read' | 'draft')[] });
      const redirect = new URL(decision.redirectUrl); assert.equal(redirect.searchParams.get('state'), prepared.state); assert.equal(redirect.searchParams.get('iss'), process.env.SITE_URL);
      const params = new URLSearchParams({ client_id: client.client_id, grant_type: 'authorization_code', code: redirect.searchParams.get('code')!, code_verifier: prepared.verifier, redirect_uri: client.redirect_uris[0], resource: mcpResource() });
      return { ...prepared, params, tokens: await exchangeOAuthToken(params) };
    };
    await suite.test('DCR et découverte : clients publics PKCE, redirects exacts et audience obligatoire', async () => {
      assert(oauthMetadata().code_challenge_methods_supported.includes('S256'));
      for (const uri of ['javascript:alert(1)', 'http://external.example/callback', 'https://user:pass@example.com/cb', 'https://example.com/cb#fragment']) await assert.rejects(registerOAuthClient({ redirect_uris: [uri] }), codeError('invalid_client_metadata'));
      await assert.rejects(registerOAuthClient({ redirect_uris: client.redirect_uris, grant_types: [] }), codeError('invalid_client_metadata'));
      const good = await prepare();
      const all = new URLSearchParams(good.query); all.delete('scope');
      const allRequest = await beginOAuthAuthorization(all);
      assert.deepEqual((await readOAuthRequest(allRequest.requestId, actor, sessionId)).allowedScopes, ['read', 'draft', 'publish', 'outreach', 'send', 'users']);
      for (const [key, value] of [['redirect_uri', 'https://attacker.example/cb'], ['resource', 'https://other.example/mcp/'], ['code_challenge_method', 'plain'], ['scope', 'read root'], ['state', '']]) {
        const query = new URLSearchParams(good.query); query.set(key, value);
        await assert.rejects(beginOAuthAuthorization(query), error => error instanceof OAuthError);
      }
    });
    await suite.test('consentement lié à la session, réduction explicite des scopes, refus conservant state', async () => {
      const pending = await prepare();
      await readOAuthRequest(pending.pending.requestId, actor, sessionId);
      await assert.rejects(readOAuthRequest(pending.pending.requestId, actor, 'other-session'), error => error instanceof HttpError && error.status === 404);
      await assert.rejects(decideOAuthRequest(pending.pending.requestId, actor, sessionId, { approve: true, scopes: [] }), codeError('invalid_scope'));
      await assert.rejects(decideOAuthRequest(pending.pending.requestId, actor, sessionId, { approve: true, scopes: ['read', 'send'] }), codeError('invalid_scope'));
      const rejected = new URL((await decideOAuthRequest(pending.pending.requestId, actor, sessionId, { approve: false, scopes: [] })).redirectUrl);
      assert.equal(rejected.searchParams.get('error'), 'access_denied'); assert.equal(rejected.searchParams.get('state'), pending.state);
    });
    await suite.test('clients confidentiels post/basic vérifient leur secret sans contourner PKCE', async () => {
      for (const method of ['client_secret_post', 'client_secret_basic']) {
        const confidential = await registerOAuthClient({ client_name: 'Confidentiel', redirect_uris: client.redirect_uris, token_endpoint_auth_method: method });
        assert(confidential.client_secret);
        const prepared = await prepare('read'); prepared.query.set('client_id', confidential.client_id);
        const pending = await beginOAuthAuthorization(prepared.query); await readOAuthRequest(pending.requestId, actor, sessionId);
        const redirect = new URL((await decideOAuthRequest(pending.requestId, actor, sessionId, { approve: true, scopes: ['read'] })).redirectUrl);
        const params = new URLSearchParams({ grant_type: 'authorization_code', client_id: confidential.client_id, code: redirect.searchParams.get('code')!, code_verifier: prepared.verifier, redirect_uri: confidential.redirect_uris[0], resource: mcpResource() });
        await assert.rejects(exchangeOAuthToken(params), codeError('invalid_client'));
        let authorization: string | undefined;
        if (method === 'client_secret_post') params.set('client_secret', confidential.client_secret);
        else authorization = 'Basic ' + Buffer.from(confidential.client_id + ':' + confidential.client_secret).toString('base64');
        const tokens = await exchangeOAuthToken(params, authorization);
        await requireOAuthAccess(requestWith(tokens.access_token));
      }
    });
    await suite.test('une modification du rôle avant consentement interdit users malgré un acteur périmé', async () => {
      const prepared = await prepare('read users');
      await getPool().query("UPDATE auth_user SET role='editor' WHERE id=$1", [actor.id]);
      try {
        assert.deepEqual((await readOAuthRequest(prepared.pending.requestId, actor, sessionId)).allowedScopes, ['read']);
        await assert.rejects(decideOAuthRequest(prepared.pending.requestId, actor, sessionId, { approve: true, scopes: ['read', 'users'] }), codeError('invalid_scope'));
      } finally { await getPool().query("UPDATE auth_user SET role='administrator' WHERE id=$1", [actor.id]); }
    });
    await suite.test('PKCE et paramètres exacts vérifiés avant échange et code consommé une fois', async () => {
      const pending = await prepare(); await readOAuthRequest(pending.pending.requestId, actor, sessionId);
      const redirect = new URL((await decideOAuthRequest(pending.pending.requestId, actor, sessionId, { approve: true, scopes: ['read'] })).redirectUrl);
      const good = new URLSearchParams({ grant_type: 'authorization_code', client_id: client.client_id, code: redirect.searchParams.get('code')!, code_verifier: pending.verifier, redirect_uri: client.redirect_uris[0], resource: mcpResource() });
      for (const [key, value] of [['code_verifier', 'b'.repeat(43)], ['redirect_uri', 'https://client.example/other'], ['resource', 'https://other.example/mcp/']]) {
        const wrong = new URLSearchParams(good); wrong.set(key, value); await assert.rejects(exchangeOAuthToken(wrong), codeError('invalid_grant'));
      }
      const tokens = await exchangeOAuthToken(good); assert(tokens.expires_in <= 900); assert.equal(tokens.scope, 'read');
      assert.equal((await requireOAuthAccess(requestWith(tokens.access_token))).actor.id, actor.id);
      const intercepted = new URLSearchParams(good); intercepted.set('code_verifier', 'x'.repeat(43));
      await assert.rejects(exchangeOAuthToken(intercepted), codeError('invalid_grant'));
      await requireOAuthAccess(requestWith(tokens.access_token));
      await assert.rejects(exchangeOAuthToken(good), codeError('invalid_grant'));
      await assert.rejects(requireOAuthAccess(requestWith(tokens.access_token)), codeError('invalid_token'));
    });
    await suite.test('client officiel échange initialize/list/call via Streamable HTTP sans session serveur mémoire', async () => {
      const { tokens } = await grant();
      const { Client, StreamableHTTPClientTransport } = await import(pathToFileURL(requireSdk.resolve('@modelcontextprotocol/client')).href);
      const sdk = new Client({ name: 'calas-http-test', version: '1' });
      const transport = new StreamableHTTPClientTransport(new URL(mcpResource()), { requestInit: { headers: { Authorization: 'Bearer ' + tokens.access_token } } });
      try {
        await sdk.connect(transport);
        const list = await sdk.listTools(); assert(list.tools.some((tool: { name: string }) => tool.name === 'calas_identity'));
        assert(!list.tools.some((tool: { name: string }) => tool.name === 'calas_queue_campaign'));
        const result = await sdk.callTool({ name: 'calas_identity', arguments: {} });
        assert.equal(JSON.parse(result.content[0].text).name, actor.name);
        assert(!JSON.stringify(result).includes(tokens.access_token));
      } finally { await sdk.close(); }
    });
    await suite.test('rotation refresh et réutilisation révoquent toute la connexion', async () => {
      const { tokens } = await grant();
      const refresh = new URLSearchParams({ client_id: client.client_id, grant_type: 'refresh_token', refresh_token: tokens.refresh_token, resource: mcpResource() });
      const rotated = await exchangeOAuthToken(refresh); assert.notEqual(rotated.refresh_token, tokens.refresh_token);
      await requireOAuthAccess(requestWith(rotated.access_token));
      await assert.rejects(exchangeOAuthToken(refresh), codeError('invalid_grant'));
      await assert.rejects(requireOAuthAccess(requestWith(rotated.access_token)), codeError('invalid_token'));
    });
    await suite.test('le quota porte sur chaque appel d’outil même concurrent, pas seulement sur les requêtes HTTP', async () => {
      const { tokens } = await grant('read');
      const { Client, StreamableHTTPClientTransport } = await import(pathToFileURL(requireSdk.resolve('@modelcontextprotocol/client')).href);
      const sdk = new Client({ name: 'calas-rate-test', version: '1' });
      const transport = new StreamableHTTPClientTransport(new URL(mcpResource()), { requestInit: { headers: { Authorization: 'Bearer ' + tokens.access_token } } });
      try {
        await sdk.connect(transport);
        const answers = await Promise.all(Array.from({ length: 61 }, () => sdk.callTool({ name: 'calas_identity', arguments: {} })));
        assert.equal(answers.filter(answer => answer.isError === true).length, 1);
        assert.match(answers.find(answer => answer.isError)?.content[0].text, /Trop d’actions/);
      } finally { await sdk.close(); }
    });
    await suite.test('révocation propriétaire et endpoint client, puis retrait de session invalident immédiatement', async () => {
      const first = await grant(), access = await requireOAuthAccess(requestWith(first.tokens.access_token));
      assert(!JSON.stringify(await listOAuthConnections(actor)).includes(first.tokens.access_token));
      await revokeOAuthConnection(actor, access.tokenId); await assert.rejects(requireOAuthAccess(requestWith(first.tokens.access_token)), codeError('invalid_token'));
      const second = await grant(); await revokeOAuthToken(new URLSearchParams({ client_id: client.client_id, token: second.tokens.refresh_token }));
      await assert.rejects(requireOAuthAccess(requestWith(second.tokens.access_token)), codeError('invalid_token'));
      const third = await grant(); await getPool().query('UPDATE auth_session SET mfa_verified=false WHERE id=$1', [sessionId]);
      await assert.rejects(requireOAuthAccess(requestWith(third.tokens.access_token)), codeError('invalid_token'));
      await getPool().query('UPDATE auth_session SET mfa_verified=true WHERE id=$1', [sessionId]);
      await getPool().query('DELETE FROM auth_session WHERE id=$1', [sessionId]);
      await assert.rejects(requireOAuthAccess(requestWith(third.tokens.access_token)), codeError('invalid_token'));
    });
  } finally {
    http.closeAllConnections(); await new Promise<void>(resolve => http.close(() => resolve()));
    await closeDatabase(); process.env.DATABASE_URL = original;
    await getPool().query(`DROP DATABASE "${database}" WITH (FORCE)`); await closeDatabase();
  }
});
