import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Actor } from '../apps/web/src/server/auth/permissions';
import { closeDatabase, getDb, getPool } from '../apps/web/src/server/db';
import { createCampaign, createProspect, getCampaignOverview, getOutreachOverview, importProspects, queueCampaign, setCampaignPaused, suppressProspect } from '../apps/web/src/server/outreach/service';
import { createMessageTemplate, deleteMessageTemplate, getCampaignPreview, getDeliveryHistory, getMessageTemplates, getOutreachCampaigns, getOutreachContacts, updateMessageTemplate } from '../apps/web/src/server/outreach/management';
import { processOutreachQueue } from '../apps/web/src/server/outreach/worker';
import { mailContent } from '../apps/web/src/server/outreach/mail';
import { queueInputSchema } from '../apps/web/src/server/outreach/validation';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(resolve(root, 'apps/web/package.json'));
const { Pool } = require('pg');
const { migrate } = await import(pathToFileURL(require.resolve('drizzle-orm/node-postgres/migrator')).href);
try { loadEnvFile(resolve(root, 'apps/web/.env')); } catch { /* isolated runner may provide env */ }

test('scheduling requires a real UTC future date within a year', () => {
  const input = { version: 0, contactIds: [randomUUID()], confirmation: true };
  assert(queueInputSchema.safeParse(input).success);
  assert(queueInputSchema.safeParse({ ...input, scheduledAt: new Date(Date.now() + 3600000).toISOString() }).success);
  for (const scheduledAt of [null, '', '2026-02-30T12:00:00Z', '2026-01-01T10:00:00Z', new Date(Date.now() + 367 * 86400000).toISOString(), '2999-01-01T00:00:00Z', '2027-01-01T12:00:00+01:00']) {
    assert.equal(queueInputSchema.safeParse({ ...input, scheduledAt }).success, false, String(scheduledAt));
  }
});

test('outreach history, reusable templates, final previews and scheduling on isolated PostgreSQL', { skip: process.env.RUN_OUTREACH_INTEGRATION !== '1' }, async t => {
  const source = new URL(process.env.DATABASE_URL!);
  assert(['127.0.0.1', 'localhost', 'postgres'].includes(source.hostname));
  const name = `calas_management_test_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString: source.href, max: 1 });
  await control.query(`CREATE DATABASE "${name}"`);
  const isolated = new URL(source); isolated.pathname = `/${name}`;
  const prior = Object.fromEntries(['DATABASE_URL', 'OUTREACH_LINK_SECRET', 'OUTREACH_MAIL_TRANSPORT', 'OUTREACH_MAX_BATCH', 'SITE_URL'].map(key => [key, process.env[key]]));
  process.env.DATABASE_URL = isolated.href;
  process.env.OUTREACH_LINK_SECRET = 'isolated-management-tests-'.repeat(3);
  process.env.OUTREACH_MAIL_TRANSPORT = 'simulation'; process.env.OUTREACH_MAX_BATCH = '2000';
  process.env.SITE_URL = 'https://www.calas-conseil.fr';
  const actor: Actor = { id: randomUUID(), name: 'Recette', email: 'editor@example.test', role: 'editor' };
  const forbidden = { ...actor, role: 'visitor' } as unknown as Actor;
  const content = { title: 'Message de recette', subject: 'Un sujet professionnel', body: 'Voici une présentation professionnelle de recette.', targetPath: '/contact/' };
  const contact = (email: string, company = 'Entreprise locale') => ({ email, name: 'Camille', company, jobTitle: 'Direction', source: 'Rencontre professionnelle autorisée', sourceDate: new Date().toISOString().slice(0, 10), informationConfirmed: true });
  const capture = async () => (await getPool().query('SELECT (SELECT count(*)::int FROM outreach_deliveries) AS deliveries,(SELECT count(*)::int FROM outreach_unsubscribe_links) AS opposition,(SELECT count(*)::int FROM outreach_campaign_visits) AS visits,(SELECT count(*)::int FROM audit_logs) AS audit')).rows[0];
  try {
    await migrate(getDb(), { migrationsFolder: resolve(root, 'drizzle') });
    await getPool().query('INSERT INTO auth_user(id,name,email,email_verified,role) VALUES($1,$2,$3,true,$4)', [actor.id, actor.name, actor.email, actor.role]);
    await t.test('template mutations are versioned, audited and independent of campaigns', async () => {
      assert.equal((await getMessageTemplates(actor)).total, 0);
      const model = await createMessageTemplate(content, actor);
      const campaign = await createCampaign(content, actor);
      const results = await Promise.allSettled([1, 2].map(index => updateMessageTemplate(model.id, { ...content, subject: 'Sujet modifié ' + index, version: 0 }, actor)));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal((await getMessageTemplates(actor, { q: 'Message', limit: 1 })).total, 1);
      assert.equal((await getCampaignOverview(campaign.id, actor)).campaign.subject, content.subject);
      await assert.rejects(() => deleteMessageTemplate(model.id, { version: 0 }, actor), { status: 409 });
      await deleteMessageTemplate(model.id, { version: 1 }, actor);
      assert.equal((await getMessageTemplates(actor)).total, 0);
      assert.equal((await getCampaignOverview(campaign.id, actor)).campaign.subject, content.subject);
      const audit = (await getPool().query("SELECT action FROM audit_logs WHERE resource_id=$1 ORDER BY created_at", [model.id])).rows.map(row => row.action);
      assert.deepEqual(audit, ['outreach.template.created', 'outreach.template.updated', 'outreach.template.deleted']);
      await assert.rejects(() => createMessageTemplate({ ...content, targetPath: '/admin/' }, actor), { status: 422 });
      await assert.rejects(() => createMessageTemplate({ ...content, targetPath: '/not-published/' }, actor), { status: 422 });
    });
    await t.test('preview uses the SMTP formatter, keeps opposition inert and has no side effects', async () => {
      const campaign = await createCampaign(content, actor), person = await createProspect(contact('preview@example.test'), actor);
      const before = await capture();
      const preview = await getCampaignPreview(campaign.id, { contactId: person.id }, actor);
      assert.deepEqual(preview.recipient, { id: person.id, email: person.email, source: person.source });
      assert.equal(preview.subject, content.subject);
      assert.equal(preview.text, mailContent({ ...content, id: 'preview', email: person.email, source: person.source, transport: 'simulation', campaignLink: campaign.linkPath, unsubscribeLink: '/r/exemple-desinscription/' }));
      assert.equal(preview.unsubscribeIsExample, true); assert.equal(preview.sourceIsExample, false);
      assert(!preview.text.includes('/r/u_')); assert(preview.text.includes('/confidentialite/'));
      const generic = await getCampaignPreview(campaign.id, {}, actor);
      assert.equal(generic.recipient, null); assert.equal(generic.sourceIsExample, true);
      assert.deepEqual(await capture(), before);
      await assert.rejects(() => getCampaignPreview(campaign.id, { contactId: randomUUID() }, actor), { status: 404 });
      await assert.rejects(() => getCampaignPreview(randomUUID(), {}, actor), { status: 404 });
    });
    await t.test('history reaches beyond 1000 rows with stable ordering, filters and literal search', async () => {
      for (let start = 0; start < 1037; start += 200) await importProspects({ contacts: Array.from({ length: Math.min(200, 1037 - start) }, (_, offset) => contact(`history-${start + offset}@example.test`)) }, actor);
      const ids = (await getPool().query<{ id: string }>("SELECT id FROM outreach_prospects WHERE email LIKE 'history-%@example.test' ORDER BY email")).rows.map(row => row.id);
      const campaign = await createCampaign({ ...content, title: 'Historique complet' }, actor);
      assert.equal((await queueCampaign(campaign.id, { version: 0, contactIds: ids, confirmation: true }, actor)).queued, 1037);
      await setCampaignPaused(campaign.id, { version: 1, paused: true }, actor);
      const first = await getDeliveryHistory(actor, { campaignId: campaign.id, offset: 0, limit: 100 });
      const last = await getDeliveryHistory(actor, { campaignId: campaign.id, offset: 1000, limit: 100 });
      assert.equal(first.total, 1037); assert.equal(last.total, 1037); assert.equal(last.items.length, 37);
      assert.equal(new Set([...first.items, ...last.items].map(item => item.id)).size, 137);
      assert(first.items.every(item => item.campaignTitle === 'Historique complet' && item.scheduledAt === null && !Object.hasOwn(item, 'unsubscribeLink')));
      assert.equal((await getDeliveryHistory(actor, { campaignId: campaign.id, status: 'accepted' })).total, 0);
      const empty = await getDeliveryHistory(actor, { campaignId: campaign.id, offset: 5000 });
      assert.equal(empty.total, 1037); assert.deepEqual(empty.items, []);
      const special = await createProspect(contact('literal@example.test', 'Entreprise 100%_unique'), actor);
      const other = await createCampaign({ ...content, title: 'Recherche littérale' }, actor);
      await queueCampaign(other.id, { version: 0, contactIds: [special.id], confirmation: true }, actor);
      await setCampaignPaused(other.id, { version: 1, paused: true }, actor);
      const literal = await getDeliveryHistory(actor, { q: '100%_' });
      assert.equal(literal.total, 1); assert.equal(literal.items[0].contactId, special.id);
      assert.equal((await getDeliveryHistory(actor, { q: "' OR true --" })).total, 0);
      for (const options of [{ offset: -1 }, { limit: 101 }, { offset: '1e3' }, { q: 'x'.repeat(101) }, { status: 'unknown' }]) await assert.rejects(() => getDeliveryHistory(actor, options), { status: 422 });
      await assert.rejects(() => getDeliveryHistory(actor, { campaignId: randomUUID() }), { status: 404 });
    });
    await t.test('summary overview preserves totals without querying legacy excerpts', async t => {
      const full = await getOutreachOverview(actor);
      assert(full.contacts.length > 1000); assert(full.campaigns.length > 0); assert.equal(full.deliveries.length, 1000);
      const pool = getPool(), query = t.mock.method(pool, 'query', pool.query.bind(pool));
      try {
        const summary = await getOutreachOverview(actor, { summaryOnly: true });
        assert.deepEqual(summary, { ...full, contacts: [], campaigns: [], deliveries: [], visits: [] });
        assert.equal(query.mock.calls.length, 2);
        assert(query.mock.calls.every(call => !String(call.arguments[0]).includes('LIMIT 1000')));
      } finally { query.mock.restore(); }
    });
    await t.test('contacts and campaigns paginate independently and eligibility excludes included or opposed recipients', async () => {
      const page = await getOutreachContacts(actor, { q: 'history-', offset: 1000, limit: 100 });
      assert.equal(page.total, 1037); assert.equal(page.items.length, 37);
      const campaigns = await getOutreachCampaigns(actor, { q: 'Historique complet', limit: 1 });
      assert.equal(campaigns.total, 1); assert.equal(campaigns.items[0].title, 'Historique complet');
      assert(campaigns.items[0].linkPath.startsWith('/r/c_')); assert(!Object.hasOwn(campaigns.items[0], 'linkEncrypted'));
      assert.equal((await getOutreachContacts(actor, { q: 'history-', campaignId: campaigns.items[0].id, eligibleOnly: true })).total, 0);
      const person = await createProspect(contact('eligibility@example.test'), actor);
      await suppressProspect(person.id, actor);
      assert.equal((await getOutreachContacts(actor, { q: 'eligibility', eligibleOnly: true })).total, 0);
      assert.equal((await getOutreachContacts(actor, { q: 'eligibility', status: 'suppressed' })).total, 1);
      await assert.rejects(() => getOutreachContacts(actor, { eligibleOnly: 'yes' }), { status: 422 });
    });
    await t.test('scheduled deliveries never run early, pause/resume and retry retain their schedule', async () => {
      const person = await createProspect(contact('schedule@example.test'), actor), campaign = await createCampaign(content, actor);
      const scheduledAt = new Date(Date.now() + 3600000).toISOString();
      const queued = await queueCampaign(campaign.id, { version: 0, contactIds: [person.id], confirmation: true, scheduledAt }, actor);
      assert.equal(queued.scheduledAt, scheduledAt);
      const stored = (await getPool().query('SELECT scheduled_at,next_attempt_at FROM outreach_deliveries WHERE campaign_id=$1', [campaign.id])).rows[0];
      assert.equal(stored.scheduled_at.toISOString(), scheduledAt); assert.equal(stored.next_attempt_at.toISOString(), scheduledAt);
      let sent = 0;
      const deliver = async () => { sent++; return 'simulated' as const; };
      await processOutreachQueue({ deliver }); assert.equal(sent, 0);
      await getPool().query('UPDATE outreach_deliveries SET next_attempt_at=now() WHERE campaign_id=$1', [campaign.id]);
      await processOutreachQueue({ deliver }); assert.equal(sent, 0);
      await setCampaignPaused(campaign.id, { version: 1, paused: true }, actor);
      await getPool().query("UPDATE outreach_deliveries SET scheduled_at=now()-interval '1 minute' WHERE campaign_id=$1", [campaign.id]);
      await processOutreachQueue({ deliver }); assert.equal(sent, 0);
      await setCampaignPaused(campaign.id, { version: 2, paused: false }, actor);
      const expectedSchedule = (await getPool().query('SELECT scheduled_at FROM outreach_deliveries WHERE campaign_id=$1', [campaign.id])).rows[0].scheduled_at.toISOString();
      await processOutreachQueue({ deliver: async () => { sent++; return 'retry'; } }); assert.equal(sent, 1);
      const retry = (await getPool().query('SELECT scheduled_at,next_attempt_at FROM outreach_deliveries WHERE campaign_id=$1', [campaign.id])).rows[0];
      assert.equal(retry.scheduled_at.toISOString(), expectedSchedule); assert(retry.next_attempt_at.getTime() > Date.now());
      await processOutreachQueue({ deliver }); assert.equal(sent, 1);
      await getPool().query('UPDATE outreach_deliveries SET next_attempt_at=now() WHERE campaign_id=$1', [campaign.id]);
      await processOutreachQueue({ deliver }); assert.equal(sent, 2);
      await processOutreachQueue({ deliver }); assert.equal(sent, 2);
    });
    await t.test('invalid schedules do not enqueue; opposition cancels a scheduled delivery', async () => {
      const person = await createProspect(contact('scheduled-opposition@example.test'), actor), campaign = await createCampaign(content, actor);
      const input = { version: 0, contactIds: [person.id], confirmation: true };
      await assert.rejects(() => queueCampaign(campaign.id, { ...input, scheduledAt: new Date(Date.now() - 1000).toISOString() }, actor), { status: 422 });
      assert.equal((await getCampaignOverview(campaign.id, actor)).stats.total, 0);
      await queueCampaign(campaign.id, { ...input, scheduledAt: new Date(Date.now() + 3600000).toISOString() }, actor);
      await suppressProspect(person.id, actor);
      assert.equal((await getDeliveryHistory(actor, { campaignId: campaign.id })).items[0].status, 'suppressed');
      let sent = 0; await processOutreachQueue({ deliver: async () => { sent++; return 'simulated'; } }); assert.equal(sent, 0);
    });
    await t.test('management functions reject roles outside the editorial team', async () => {
      for (const action of [() => getDeliveryHistory(forbidden), () => getOutreachContacts(forbidden), () => getOutreachCampaigns(forbidden), () => getMessageTemplates(forbidden), () => createMessageTemplate(content, forbidden), () => getCampaignPreview(randomUUID(), {}, forbidden)]) await assert.rejects(action, { status: 403 });
    });
  } finally {
    await closeDatabase();
    for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await control.query(`DROP DATABASE "${name}" WITH (FORCE)`); await control.end();
  }
});
