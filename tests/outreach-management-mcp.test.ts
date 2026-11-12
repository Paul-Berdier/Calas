import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Actor } from '../apps/web/src/server/auth/permissions';
import type { AgentAccess } from '../apps/web/src/server/agent/access';
import type { CampaignPreview, DeliveryHistoryItem, MessageTemplate, OutreachPage } from '../apps/web/src/lib/outreach-management';
import { availableAgentTools, callAgentTool } from '../apps/web/src/server/agent/tools';
import { closeDatabase, getDb, getPool } from '../apps/web/src/server/db';
import { createCampaign, createProspect } from '../apps/web/src/server/outreach/service';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(resolve(root, 'apps/web/package.json'));
const { Pool } = require('pg');
const { migrate } = await import(pathToFileURL(require.resolve('drizzle-orm/node-postgres/migrator')).href);
try { loadEnvFile(resolve(root, 'apps/web/.env')); } catch { /* environment supplied by runner */ }
const actor: Actor = { id: randomUUID(), name: 'Recette MCP', email: 'mcp-management@example.test', role: 'editor' };
const read: AgentAccess = { actor, tokenId: randomUUID(), scopes: ['read'] };
const outreach: AgentAccess = { ...read, scopes: ['read', 'outreach'] };
const full: AgentAccess = { ...read, scopes: ['read', 'outreach', 'send'] };
const content = { title: 'Modèle professionnel', subject: 'Sujet de recette', body: 'Présentation professionnelle de recette pour les entreprises.', targetPath: '/contact/' };

test('management MCP descriptors expose read-only previews, separate template editing and confirmed sending', async () => {
  const readTools = availableAgentTools(read), editTools = availableAgentTools(outreach), fullTools = availableAgentTools(full);
  for (const name of ['calas_preview_campaign', 'calas_message_templates', 'calas_operations_status', 'calas_list_outreach']) {
    const tool = readTools.find(item => item.name === name); assert(tool);
    assert.equal(tool.annotations.readOnlyHint, true); assert.equal(tool.annotations.destructiveHint, false);
    assert.deepEqual(tool._meta.securitySchemes, [{ type: 'oauth2', scopes: ['read'] }]);
  }
  for (const name of ['calas_create_message_template', 'calas_update_message_template', 'calas_delete_message_template']) {
    assert(!readTools.some(item => item.name === name));
    assert.equal(editTools.find(item => item.name === name)?.annotations.readOnlyHint, false);
    await assert.rejects(() => callAgentTool(read, name, {}), { status: 403, code: 'AGENT_SCOPE' });
  }
  assert(!editTools.some(item => item.name === 'calas_queue_campaign'));
  assert.equal(fullTools.find(item => item.name === 'calas_queue_campaign')?.annotations.openWorldHint, true);
  assert.equal(editTools.find(item => item.name === 'calas_delete_message_template')?.annotations.destructiveHint, true);
  assert.doesNotThrow(() => JSON.stringify(fullTools));
});

test('MCP invalid confirmations, schedules and incompatible list filters reject before execution', async () => {
  let executions = 0; const hook = async () => { executions++; };
  const id = randomUUID(), contactId = randomUUID(), future = new Date(Date.now() + 3600000).toISOString();
  await assert.rejects(() => callAgentTool(outreach, 'calas_queue_campaign', { id, version: 0, contactIds: [contactId], confirmation: true, scheduledAt: future }, hook), { status: 403 });
  for (const args of [{ id, version: 0, contactIds: [contactId], scheduledAt: future }, { id, version: 0, contactIds: [contactId], confirmation: false }, { id, version: 0, contactIds: [contactId], confirmation: true, scheduledAt: 'tomorrow' }, { id, version: 0, contactIds: [contactId], confirmation: true, scheduledAt: null }]) {
    await assert.rejects(() => callAgentTool(full, 'calas_queue_campaign', args, hook), { status: 422 });
  }
  for (const args of [{ collection: 'campaigns', campaignId: id }, { collection: 'visits', q: 'secret' }, { collection: 'visits', campaignId: id }, { collection: 'visits', status: 'accepted' }, { collection: 'deliveries', limit: 101 }, { collection: 'contacts', offset: -1 }, { collection: 'deliveries', q: 'x'.repeat(101) }]) {
    await assert.rejects(() => callAgentTool(read, 'calas_list_outreach', args, hook), { status: 422 });
  }
  for (const [name, args] of [['calas_delete_message_template', { id, version: 0 }], ['calas_update_message_template', { id, changes: content }], ['calas_create_message_template', { ...content, extra: 'invalid' }], ['calas_preview_campaign', { id, contactId: 'not-an-id' }]] as const) {
    await assert.rejects(() => callAgentTool(full, name, args, hook), { status: 422 });
  }
  assert.equal(executions, 0);
});

test('MCP management tools use the real isolated database without invoking SMTP', { skip: process.env.RUN_OUTREACH_INTEGRATION !== '1' }, async t => {
  const source = new URL(process.env.DATABASE_URL!); assert(['127.0.0.1', 'localhost'].includes(source.hostname));
  const name = `calas_management_mcp_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString: source.href, max: 1 }); await control.query(`CREATE DATABASE "${name}"`);
  const isolated = new URL(source); isolated.pathname = '/' + name;
  const before = Object.fromEntries(['DATABASE_URL', 'OUTREACH_LINK_SECRET', 'OUTREACH_MAIL_TRANSPORT', 'SITE_URL'].map(key => [key, process.env[key]]));
  Object.assign(process.env, { DATABASE_URL: isolated.href, OUTREACH_LINK_SECRET: 'isolated-mcp-management-'.repeat(3), OUTREACH_MAIL_TRANSPORT: 'simulation', SITE_URL: 'https://www.calas-conseil.fr' });
  try {
    await migrate(getDb(), { migrationsFolder: resolve(root, 'drizzle') });
    await getPool().query('INSERT INTO auth_user(id,name,email,email_verified,role) VALUES($1,$2,$3,true,$4)', [actor.id, actor.name, actor.email, actor.role]);
    for (const transport of [undefined, 'oauth'] as const) {
      const access = { ...full, transport }, viewing = { ...read, transport };
      await t.test(`${transport ?? 'local bridge'}: template version conflicts and confirmed deletion`, async () => {
        const created = await callAgentTool(access, 'calas_create_message_template', content) as MessageTemplate;
        const page = await callAgentTool(viewing, 'calas_message_templates', { q: 'Modèle', offset: 0, limit: 1 }) as OutreachPage<MessageTemplate>;
        assert.equal(page.items[0].id, created.id); assert.equal(page.total, 1);
        const updated = await callAgentTool(access, 'calas_update_message_template', { id: created.id, changes: { ...content, subject: 'Sujet corrigé', version: 0 } }) as MessageTemplate;
        assert.equal(updated.version, 1);
        await assert.rejects(() => callAgentTool(access, 'calas_update_message_template', { id: created.id, changes: { ...content, version: 0 } }), { status: 409 });
        await assert.rejects(() => callAgentTool(access, 'calas_delete_message_template', { id: created.id, version: 1, confirmation: false }), { status: 422 });
        await callAgentTool(access, 'calas_delete_message_template', { id: created.id, version: 1, confirmation: true });
        assert.equal((await callAgentTool(viewing, 'calas_message_templates', {}) as OutreachPage<MessageTemplate>).total, 0);
      });
      await t.test(`${transport ?? 'local bridge'}: preview and history are read-only; scheduling is persisted only with confirmation`, async () => {
        const person = await createProspect({ email: `${transport ?? 'local'}@example.test`, name: 'Recette', company: 'Entreprise MCP 100%_locale', jobTitle: 'Direction', source: 'Rencontre professionnelle de recette', sourceDate: new Date().toISOString().slice(0, 10), informationConfirmed: true }, actor);
        const campaign = await createCampaign(content, actor);
        const beforePreview = (await getPool().query('SELECT (SELECT count(*)::int FROM outreach_unsubscribe_links) AS links,(SELECT count(*)::int FROM outreach_deliveries) AS deliveries')).rows[0];
        const preview = await callAgentTool(viewing, 'calas_preview_campaign', { id: campaign.id, contactId: person.id }) as CampaignPreview;
        assert.equal(preview.recipient?.email, person.email); assert.equal(preview.unsubscribeIsExample, true);
        assert(preview.text.includes(campaign.linkPath)); assert(!preview.text.includes('/r/u_'));
        assert.deepEqual((await getPool().query('SELECT (SELECT count(*)::int FROM outreach_unsubscribe_links) AS links,(SELECT count(*)::int FROM outreach_deliveries) AS deliveries')).rows[0], beforePreview);
        const args = { id: campaign.id, version: 0, contactIds: [person.id], confirmation: true };
        await assert.rejects(() => callAgentTool(access, 'calas_queue_campaign', { ...args, scheduledAt: '2020-01-01T00:00:00Z' }), { status: 422 });
        const scheduledAt = new Date(Date.now() + 3600000).toISOString();
        const result = await callAgentTool(access, 'calas_queue_campaign', { ...args, scheduledAt }) as { queued: number; scheduledAt: string; simulation: boolean };
        assert.equal(result.queued, 1); assert.equal(result.scheduledAt, scheduledAt); assert.equal(result.simulation, true);
        const history = await callAgentTool(viewing, 'calas_list_outreach', { collection: 'deliveries', campaignId: campaign.id, q: '100%_', status: 'queued', offset: 0, limit: 1 }) as OutreachPage<DeliveryHistoryItem> & { available: number; hasMore: boolean };
        assert.equal(history.total, 1); assert.equal(history.available, 1); assert.equal(history.hasMore, false);
        assert.equal(new Date(history.items[0].scheduledAt!).toISOString(), scheduledAt);
        assert.equal((await callAgentTool(viewing, 'calas_list_outreach', { collection: 'deliveries', campaignId: campaign.id, status: 'accepted' }) as OutreachPage<DeliveryHistoryItem>).total, 0);
        assert.equal((await getPool().query('SELECT attempts FROM outreach_deliveries WHERE campaign_id=$1', [campaign.id])).rows[0].attempts, 0);
      });
    }
  } finally {
    await closeDatabase();
    for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await control.query(`DROP DATABASE "${name}" WITH (FORCE)`); await control.end();
  }
});
