import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { closeDatabase, getPool } from '../apps/web/src/server/db';
import { migrateDatabase } from '../apps/web/src/server/db/migrate';
import { createAgentToken, listAgentTokens, requireAgentAccess, revokeAgentToken } from '../apps/web/src/server/agent/access';
import { availableAgentTools, callAgentTool } from '../apps/web/src/server/agent/tools';
import type { Actor } from '../apps/web/src/server/auth/permissions';
import { HttpError } from '../apps/web/src/server/http';

try { loadEnvFile(fileURLToPath(new URL('../apps/web/.env', import.meta.url))); } catch { /* CI provides its environment. */ }
const original = process.env.DATABASE_URL;
const local = original && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(original).hostname);
const denied = (status: number) => (error: unknown) => error instanceof HttpError && error.status === status;
const editor: Actor = { id: 'agent-test-editor', name: 'Éditeur recette', email: 'editor@example.test', role: 'editor' };
const admin: Actor = { id: 'agent-test-admin', name: 'Admin recette', email: 'admin@example.test', role: 'administrator' };
const request = (token: string, extra: Record<string, string> = {}) => new Request('https://example.test/api/agent/tools/', { headers: { authorization: `Bearer ${token}`, ...extra } });

test('accès IA : session réelle, droits actuels, expiration et révocation PostgreSQL', { skip: !local, timeout: 120_000 }, async suite => {
  const name = `calas_agent_test_${randomUUID().replaceAll('-', '')}`;
  await getPool().query(`CREATE DATABASE "${name}"`); await closeDatabase();
  const isolated = new URL(original!); isolated.pathname = '/' + name;
  process.env.DATABASE_URL = isolated.href; process.env.SITE_ENV = 'test';
  try {
    await migrateDatabase(fileURLToPath(new URL('../drizzle', import.meta.url)));
    for (const actor of [editor, admin]) {
      await getPool().query('INSERT INTO auth_user(id,name,email,email_verified,role,two_factor_enabled) VALUES($1,$2,$3,true,$4,true)', [actor.id, actor.name, actor.email, actor.role]);
      await getPool().query("INSERT INTO auth_session(id,user_id,token,expires_at,mfa_verified) VALUES($1,$2,$1,now()+interval '24 hours',true)", ['session-' + actor.id, actor.id]);
    }
    const issued = await createAgentToken(editor, 'session-' + editor.id, { name: 'Lecture', scopes: ['read'] });
    await suite.test('secret aléatoire montré une fois et hash uniquement conservé', async () => {
      assert.match(issued.token, /^calas_[A-Za-z0-9_-]{43}$/);
      assert.equal(issued.item.expiresAt.getTime() - issued.item.createdAt.getTime(), 8 * 60 * 60_000);
      const row = (await getPool().query('SELECT * FROM agent_tokens WHERE id=$1', [issued.item.id])).rows[0];
      assert(!JSON.stringify(row).includes(issued.token)); assert.equal(row.token_hash.length, 64);
      assert(!JSON.stringify(await listAgentTokens(editor)).includes(issued.token));
    });
    await suite.test('lecture ne peut pas appeler envoi/publication et rôle éditeur ne reçoit pas users', async () => {
      const access = await requireAgentAccess(request(issued.token));
      assert(!availableAgentTools(access).some(tool => tool.name === 'calas_queue_campaign'));
      await assert.rejects(callAgentTool(access, 'calas_queue_campaign', {}), denied(403));
      await assert.rejects(callAgentTool(access, 'calas_publish_content', {}), denied(403));
      await assert.rejects(createAgentToken(editor, 'session-' + editor.id, { name: 'Escalade', scopes: ['read', 'users'] }), denied(403));
      await assert.rejects(createAgentToken(admin, 'session-' + editor.id, { name: 'Autre session', scopes: ['read'] }), denied(401));
      await assert.rejects(requireAgentAccess(request(issued.token, { cookie: 'session=whatever' })), denied(403));
      await assert.rejects(requireAgentAccess(request(issued.token, { origin: 'https://example.test' })), denied(403));
    });
    await suite.test('suspension, email et MFA sont relus à chaque requête', async () => {
      for (const [column, bad, good] of [['disabled', true, false], ['email_verified', false, true], ['two_factor_enabled', false, true]] as const) {
        await getPool().query(`UPDATE auth_user SET ${column}=$1 WHERE id=$2`, [bad, editor.id]);
        await assert.rejects(requireAgentAccess(request(issued.token)), denied(401));
        await getPool().query(`UPDATE auth_user SET ${column}=$1 WHERE id=$2`, [good, editor.id]);
      }
      await getPool().query('UPDATE auth_session SET mfa_verified=false WHERE user_id=$1', [editor.id]);
      await assert.rejects(requireAgentAccess(request(issued.token)), denied(401));
      await getPool().query('UPDATE auth_session SET mfa_verified=true WHERE user_id=$1', [editor.id]);
    });
    await suite.test('le journal préalable refuse avant mutation et après validation du périmètre', async () => {
      const drafting = await createAgentToken(editor, 'session-' + editor.id, { name: 'Brouillons', scopes: ['read', 'draft'] });
      const access = await requireAgentAccess(request(drafting.token));
      const resourceId = randomUUID();
      const args = { id: resourceId, kind: 'category', content: { title: 'Recette', slug: 'recette' } };
      let checks = 0;
      await assert.rejects(callAgentTool(access, 'calas_create_draft', args, async () => { checks++; throw new Error('Journal indisponible'); }), /Journal indisponible/);
      assert.equal(checks, 1);
      assert.equal((await getPool().query('SELECT id FROM content_documents WHERE id=$1', [resourceId])).rowCount, 0);
      await assert.rejects(callAgentTool(access, 'calas_queue_campaign', {}, async () => { checks++; }), denied(403));
      assert.equal(checks, 1);
      const created = await callAgentTool(access, 'calas_create_draft', args, async () => { checks++; });
      assert.equal((created as { id: string }).id, resourceId); assert.equal(checks, 2);
      await revokeAgentToken(editor, drafting.item.id);
    });
    await suite.test('seul le propriétaire révoque et la révocation est immédiate', async () => {
      await assert.rejects(revokeAgentToken(admin, issued.item.id), denied(404));
      await revokeAgentToken(editor, issued.item.id);
      await assert.rejects(requireAgentAccess(request(issued.token)), denied(401));
    });
    await suite.test('un accès complet ne conserve pas les droits administrateur après changement de rôle', async () => {
      const full = await createAgentToken(admin, 'session-' + admin.id, { name: 'Gestion', scopes: ['read', 'users'] });
      assert(availableAgentTools(await requireAgentAccess(request(full.token))).some(tool => tool.name === 'calas_list_users'));
      await getPool().query("UPDATE auth_user SET role='editor' WHERE id=$1", [admin.id]);
      const changed = await requireAgentAccess(request(full.token));
      assert.equal(changed.actor.role, 'editor');
      await assert.rejects(callAgentTool(changed, 'calas_list_users', {}), denied(403));
      await getPool().query("UPDATE auth_user SET role='administrator' WHERE id=$1", [admin.id]);
      await revokeAgentToken(admin, full.item.id);
    });
    await suite.test('créations concurrentes ne dépassent pas dix accès actifs', async () => {
      const results = await Promise.allSettled(Array.from({ length: 11 }, (_, i) => createAgentToken(admin, 'session-' + admin.id, { name: 'Parallèle ' + i, scopes: ['read'] })));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 10);
      const failure = results.find(result => result.status === 'rejected');
      assert(failure?.status === 'rejected' && failure.reason instanceof HttpError && failure.reason.code === 'TOKEN_LIMIT');
    });
    await suite.test('expiration session borne l’accès et déconnexion le supprime', async () => {
      await getPool().query("UPDATE auth_session SET expires_at=now()+interval '1 hour' WHERE user_id=$1", [editor.id]);
      const short = await createAgentToken(editor, 'session-' + editor.id, { name: 'Session courte', scopes: ['read', 'draft'] });
      assert(short.item.expiresAt.getTime() - short.item.createdAt.getTime() <= 60 * 60_000);
      await getPool().query('DELETE FROM auth_session WHERE user_id=$1', [editor.id]);
      await assert.rejects(requireAgentAccess(request(short.token)), denied(401));
      assert.equal((await listAgentTokens(editor)).length, 0);
    });
  } finally {
    await closeDatabase(); process.env.DATABASE_URL = original;
    await getPool().query(`DROP DATABASE "${name}" WITH (FORCE)`); await closeDatabase();
  }
});
