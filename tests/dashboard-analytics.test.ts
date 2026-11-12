import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closeDatabase, getDb, getPool } from '../apps/web/src/server/db';
import { dashboardCampaignId, dashboardDateRange, dashboardPeriod, getDashboardCampaignOptions, getDashboardMetrics } from '../apps/web/src/server/outreach/analytics';
import { getCampaignLanding, recordCampaignVisit } from '../apps/web/src/server/outreach/service';
import { digest, makeToken, seal } from '../apps/web/src/server/outreach/tokens';
import { availableAgentTools, callAgentTool } from '../apps/web/src/server/agent/tools';
import type { AgentAccess } from '../apps/web/src/server/agent/access';
import type { Actor } from '../apps/web/src/server/auth/permissions';
import type { DashboardCampaignOptions, DashboardMetrics } from '../apps/web/src/lib/dashboard-metrics';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(resolve(root, 'apps/web/package.json'));
const { Pool } = require('pg');
const { migrate } = await import(pathToFileURL(require.resolve('drizzle-orm/node-postgres/migrator')).href);
try { loadEnvFile(resolve(root, 'apps/web/.env')); } catch { /* Runner may provide environment. */ }
const actor: Actor = { id: randomUUID(), name: 'Recette statistiques', email: 'analytics@example.test', role: 'editor' };

test('custom date ranges are strict UTC calendar intervals, including leap years and DST days', () => {
  const now = new Date('2026-11-12T00:15:00Z');
  assert.deepEqual(dashboardDateRange(undefined, {}, now), {days:30,from:null,to:null});
  for (const [from,to,days] of [['2024-02-28','2024-03-01',3],['2024-01-01','2024-12-31',366],['2026-03-28','2026-03-30',3],['2026-10-24','2026-10-26',3],['2026-11-12','2026-11-12',1]] as const) {
    assert.deepEqual(dashboardDateRange(undefined,{from,to},now),{days,from,to});
  }
  for(const range of [{from:'2026-02-29',to:'2026-03-01'},{from:'2026-04-31',to:'2026-05-01'},{from:'2026-11-12',to:'2026-11-13'},{from:'2026-11-12'}, {to:'2026-11-12'}, {from:'2026-11-12',to:'2026-11-11'}, {from:'2025-01-01',to:'2026-01-02'}, {from:'1969-12-31',to:'1970-01-01'}, {from:'2026-1-01',to:'2026-01-02'}, {from:['2026-01-01'],to:'2026-01-02'}, {from:'2026-01-01T00:00:00Z',to:'2026-01-02'}]) {
    assert.throws(()=>dashboardDateRange(undefined,range,now),{status:422,code:'PERIOD'});
  }
  assert.throws(()=>dashboardDateRange(7,{from:'2026-11-01',to:'2026-11-02'},now),{status:422,code:'PERIOD'});
});

test('dashboard periods are strict and unauthorized roles cannot access aggregates', async () => {
  assert.equal(dashboardPeriod(), 30);
  for (const days of [7, 30, 90] as const) {
    assert.equal(dashboardPeriod(days), days);
    assert.equal(dashboardPeriod(String(days)), days);
  }
  for (const invalid of [null, '', ' 7', '7.0', '7e0', 0, -7, 8, 91, [], {}, true]) {
    assert.throws(() => dashboardPeriod(invalid), { status: 422 });
  }
  await assert.rejects(() => getDashboardMetrics({ ...actor, role: 'reader' } as unknown as Actor), { status: 403 });
  await assert.rejects(() => getDashboardMetrics(undefined as unknown as Actor), { status: 403 });
  await assert.rejects(() => getDashboardMetrics(actor, 'invalid'), { status: 422 });
  assert.equal(dashboardCampaignId(), undefined);
  const validId = randomUUID();
  assert.equal(dashboardCampaignId(validId), validId);
  for (const invalid of ['', null, 'all', 'invalid', [], 1, `${validId} `]) {
    await assert.rejects(() => getDashboardMetrics(actor, 7, invalid), { status: 422, code: 'CAMPAIGN' });
  }
  await assert.rejects(() => getDashboardCampaignOptions({ ...actor, role: 'reader' } as unknown as Actor), { status: 403 });
  for (const options of [{ offset: -1 }, { offset: '1.0' }, { offset: ' 1' }, { offset: '01' }, { offset: 1.5 }, { offset: 2147483648 }, { limit: 0 }, { limit: 51 }, { limit: '1e1' }, { q: [] }, { q: 'a'.repeat(101) }]) {
    await assert.rejects(() => getDashboardCampaignOptions(actor, options), { status: 422 });
  }
});

test('analytics MCP catalogue is read-only and rejects missing scope or invalid periods before execution', async () => {
  const access: AgentAccess = { actor, tokenId: randomUUID(), scopes: ['read'] };
  const tool = availableAgentTools(access).find(item => item.name === 'calas_outreach_analytics');
  assert(tool, 'Analytics must be available with the read scope alone');
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.annotations.destructiveHint, false);
  assert.equal(tool.annotations.openWorldHint, false);
  assert.deepEqual(tool._meta.securitySchemes, [{ type: 'oauth2', scopes: ['read'] }]);
  assert(!availableAgentTools({ ...access, scopes: ['outreach'] }).some(item => item.name === tool.name));
  let executions = 0;
  const beforeExecution = async () => { executions++; };
  await assert.rejects(() => callAgentTool({ ...access, scopes: ['outreach'] }, tool.name, { days: 7 }, beforeExecution), { status: 403, code: 'AGENT_SCOPE' });
  for (const args of [{ days: 8 }, { days: '7' }, { days: null }, { days: 30, recipient: 'private@example.test' }, { campaignId: 'invalid' }, {from:'2024-02-29'}, {to:'2024-02-29'}, {days:7,from:'2024-02-28',to:'2024-02-29'}, {from:'2026-02-29',to:'2026-03-01'}]) {
    await assert.rejects(() => callAgentTool(access, tool.name, args, beforeExecution), { status: 422, code: 'VALIDATION' });
  }
  const selector = availableAgentTools(access).find(item => item.name === 'calas_outreach_campaigns');
  assert(selector?.annotations.readOnlyHint);
  assert.deepEqual(selector._meta.securitySchemes, [{ type: 'oauth2', scopes: ['read'] }]);
  await assert.rejects(() => callAgentTool({ ...access, scopes: ['outreach'] }, selector.name, {}, beforeExecution), { status: 403 });
  for (const args of [{ limit: 51 }, { offset: -1 }, { offset: '0' }, { q: 'a'.repeat(101) }]) {
    await assert.rejects(() => callAgentTool(access, selector.name, args, beforeExecution), { status: 422 });
  }
  assert.equal(executions, 0, 'Rejected MCP requests must never execute an aggregate or its audit hook');
});

test('dashboard aggregates use complete, isolated PostgreSQL data', { skip: process.env.RUN_OUTREACH_INTEGRATION !== '1' }, async t => {
  const source = new URL(process.env.DATABASE_URL!);
  assert(['127.0.0.1', 'localhost'].includes(source.hostname), 'Only a local test database is allowed');
  const name = `calas_dashboard_test_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString: source.href, max: 1 });
  await control.query(`CREATE DATABASE "${name}"`);
  const previous = Object.fromEntries(['DATABASE_URL', 'DATABASE_POOL_MAX', 'OUTREACH_MAIL_TRANSPORT', 'OUTREACH_RUNNER_ENABLED', 'OUTREACH_MAX_PER_HOUR', 'OUTREACH_LINK_SECRET'].map(key => [key, process.env[key]]));
  const isolated = new URL(source); isolated.pathname = `/${name}`;
  process.env.DATABASE_URL = isolated.href;
  process.env.DATABASE_POOL_MAX = '1';
  process.env.OUTREACH_MAIL_TRANSPORT = 'smtp';
  process.env.OUTREACH_RUNNER_ENABLED = 'true';
  process.env.OUTREACH_MAX_PER_HOUR = '40';
  process.env.OUTREACH_LINK_SECRET = randomUUID() + randomUUID();
  const campaignTokens = new Map<string, string>();
  const campaign = async (title: string, status = 'active', recent = false) => {
    const id = randomUUID(), token = makeToken('c');
    campaignTokens.set(id, token);
    await getPool().query(`INSERT INTO outreach_campaigns(id,title,subject,body,target_path,status,link_hash,link_encrypted,created_by,created_at)
      VALUES($1::uuid,$2,'Sujet privé','Corps privé','/contact/',$3,$6,$7,$4,now()-CASE WHEN $5 THEN interval '0 days' ELSE interval '100 days' END)`, [id, title, status, actor.id, recent, digest(token), seal(token)]);
    return id;
  };
  const contact = async () => {
    const id = randomUUID();
    await getPool().query(`INSERT INTO outreach_prospects(id,email,email_hash,name,company,job_title,source,source_date,information_confirmed,retention_until,created_by)
      VALUES($1::uuid,$2,$1::text,'Nom privé','Entreprise privée','Direction','Recette',current_date,true,now()+interval '1 year',$3)`, [id, `${id}@example.test`, actor.id]);
    return id;
  };
  const delivery = async (campaignId: string, transport: string, status: string, createdAt: string, finishedAt: string | null) => {
    const contactId = await contact(), id = randomUUID();
    await getPool().query(`INSERT INTO outreach_deliveries(id,campaign_id,contact_id,email,email_hash,subject,body,transport,status,unsubscribe_hash,unsubscribe_encrypted,created_at,finished_at)
      VALUES($1::uuid,$2,$3::uuid,$4,$3::text,'Sujet privé','Corps privé',$5,$6,$1::text,'private-unsubscribe-token',$7,$8)`, [id, campaignId, contactId, `${contactId}@example.test`, transport, status, createdAt, finishedAt]);
  };
  try {
    await migrate(getDb(), { migrationsFolder: resolve(root, 'drizzle') });
    await getPool().query('INSERT INTO auth_user(id,name,email,email_verified,role) VALUES($1,$2,$3,true,$4)', [actor.id, actor.name, actor.email, actor.role]);
    // A non-UTC database connection must not move the daily boundaries.
    await getPool().query("SET TIME ZONE 'Pacific/Auckland'");
    await t.test('empty data returns every calendar day and zero totals', async () => {
      for (const days of [7, 30, 90] as const) {
        const data = await getDashboardMetrics(actor, days);
        assert.equal(data.daily.length, days);
        assert(data.daily.every(day => day.accepted === 0 && day.arrivals === 0 && day.consultations === 0));
        assert.equal(data.period.timeZone, 'UTC');
        assert.equal(data.activity.accepted, 0);
        assert.equal(data.campaign, null);
        assert.deepEqual(data.campaigns, []);
        assert.deepEqual(data.pages, []);
        assert.deepEqual(data.current.queue, { waiting: 0, sending: 0, paused: 0 });
      }
    });
    const bulk = await campaign('Campagne de mille envois');
    await getPool().query(`INSERT INTO outreach_prospects(email,email_hash,name,company,job_title,source,source_date,information_confirmed,retention_until,created_by)
      SELECT 'bulk-'||n||'@example.test','bulk-'||n,'Nom privé','Entreprise','Direction','Recette',current_date,true,now()+interval '1 year',$1 FROM generate_series(1,1001) g(n)`, [actor.id]);
    await getPool().query(`INSERT INTO outreach_deliveries(campaign_id,contact_id,email,email_hash,subject,body,transport,status,unsubscribe_hash,unsubscribe_encrypted,created_at,finished_at)
      SELECT $1,id,email,email_hash,'Sujet privé','Corps privé','smtp','accepted',email_hash,'private-unsubscribe-token',now()-interval '100 days',now()
      FROM outreach_prospects`, [bulk]);
    await getPool().query(`INSERT INTO outreach_campaign_visits(campaign_id,path,day,arrivals,visits)
      VALUES($1,'/contact/',(now() AT TIME ZONE 'UTC')::date,5,9),($1,'/reflexions/',(now() AT TIME ZONE 'UTC')::date,3,6)`, [bulk]);
    await t.test('over 1000 outcomes are counted once without multiplying visits', async () => {
      const data = await getDashboardMetrics(actor, 7);
      assert.equal(data.activity.accepted, 1001);
      assert.equal(data.activity.requested, 0, 'Old requests finished during the period still count as outcomes');
      assert.equal(data.activity.arrivals, 8);
      assert.equal(data.activity.consultations, 15);
      assert.equal(data.campaigns[0].accepted, 1001);
      assert.equal(data.campaigns[0].consultations, 15);
      assert.equal(data.campaignRowsTotal, 1, 'An old campaign with current activity is included');
      assert.equal(data.current.contacts.eligible, 1001);
      assert.equal(data.daily.reduce((total, day) => total + day.accepted, 0), 1001);
      assert.equal(data.current.transport, 'smtp');
      assert.equal(data.current.workerEnabled, true);
      assert.equal(data.current.hourlyLimit, 40);
    });
    const times = (await getPool().query<{ start: Date; before: Date; now: Date; future: Date; old: Date; today: string }>(`SELECT
      (((now() AT TIME ZONE 'UTC')::date-6)::timestamp AT TIME ZONE 'UTC') AS start,
      (((now() AT TIME ZONE 'UTC')::date-6)::timestamp AT TIME ZONE 'UTC')-interval '1 millisecond' AS before,
      now() AS now,now()+interval '2 days' AS future,now()-interval '100 days' AS old,(now() AT TIME ZONE 'UTC')::date::text AS today`)).rows[0];
    const { start, before, now, future, old } = Object.fromEntries(Object.entries(times).filter(([key]) => key !== 'today').map(([key, value]) => [key, (value as Date).toISOString()]));
    const boundary = await campaign('Frontières UTC');
    await delivery(boundary, 'smtp', 'accepted', start, start);
    await delivery(boundary, 'smtp', 'accepted', before, before);
    await delivery(boundary, 'smtp', 'accepted', future, future);
    await delivery(boundary, 'smtp', 'queued', now, now);
    await delivery(boundary, 'smtp', 'sending', now, null);
    await delivery(boundary, 'smtp', 'failed', now, now);
    await delivery(boundary, 'smtp', 'uncertain', now, now);
    await delivery(boundary, 'smtp', 'suppressed', now, now);
    await delivery(boundary, 'simulation', 'simulated', now, now);
    await delivery(boundary, 'local', 'accepted', now, now);
    await delivery(boundary, 'local', 'failed', now, now);
    await delivery(boundary, 'simulation', 'suppressed', now, now);
    await delivery(boundary, 'smtp', 'accepted', now, old);
    await delivery(boundary, 'smtp', 'accepted', old, now);
    await getPool().query(`INSERT INTO outreach_campaign_visits(campaign_id,path,day,arrivals,visits)
      VALUES($1,'/contact/',$2::date-6,2,4),($1,'/contact/',$2::date-7,200,400),($1,'/contact/',$2::date+2,300,600)`, [boundary, times.today]);
    await t.test('UTC interval includes its first instant, excludes future and retries, and separates transports', async () => {
      const data = await getDashboardMetrics(actor, 7);
      assert.equal(data.period.from, start.slice(0, 10));
      assert.equal(data.period.to, times.today);
      assert.equal(data.activity.accepted, 1003);
      assert.equal(data.activity.requested, 7);
      assert.equal(data.activity.failed, 1);
      assert.equal(data.activity.uncertain, 1);
      assert.equal(data.activity.suppressed, 1);
      assert.equal(data.activity.simulated, 1);
      assert.equal(data.activity.localAccepted, 1);
      assert.equal(data.activity.arrivals, 10);
      assert.equal(data.activity.consultations, 19);
      assert.deepEqual(data.daily[0], { day: start.slice(0, 10), accepted: 1, arrivals: 2, consultations: 4 });
      assert.equal(data.daily.filter(day => !day.accepted && !day.consultations).length, 5);
      assert.deepEqual(data.current.queue, { waiting: 1, sending: 1, paused: 0 });
    });
    const paused = await campaign('Pause', 'paused');
    await delivery(paused, 'smtp', 'queued', now, null);
    await delivery(paused, 'smtp', 'sending', now, null);
    await t.test('queue snapshot distinguishes paused work from waiting and already sending', async () => {
      const data = await getDashboardMetrics(actor, 7);
      assert.deepEqual(data.current.queue, { waiting: 1, sending: 2, paused: 1 });
      assert.deepEqual(data.current.campaigns, { total: 3, drafts: 0, active: 2, paused: 1 });
    });
    const expired = await contact(), responded = await contact(), excluded = await contact();
    await getPool().query("UPDATE outreach_prospects SET retention_until=now()-interval '1 day' WHERE id=$1", [expired]);
    await getPool().query("UPDATE outreach_prospects SET status='responded',last_response_at=now() WHERE id=$1", [responded]);
    await getPool().query("INSERT INTO outreach_suppressions(email_hash,reason) VALUES($1,'operator'),('erased-contact','erasure')", [excluded]);
    await t.test('eligible contacts exclude expired, responded and opposed; erased exclusions remain counted', async () => {
      const data = await getDashboardMetrics(actor, 7);
      assert.equal(data.current.contacts.eligible, data.current.contacts.total - 3);
      assert.equal(data.current.contacts.responded, 1);
      assert.equal(data.current.contacts.excluded, 2);
      assert.equal(data.activity.responsesRecorded, 1);
      assert.equal(data.activity.exclusionsAdded, 2);
    });
    for (let index = 0; index < 12; index++) {
      const id = await campaign(`Nouvelle campagne ${index}`, 'draft', true);
      await getPool().query('INSERT INTO outreach_campaign_visits(campaign_id,path,day,arrivals,visits) VALUES($1,$2,$3,1,1)', [id, `/page-${index}/`, times.today]);
    }
    await t.test('top lists are capped but totals cover every row and expose no recipient secrets', async () => {
      const data = await getDashboardMetrics({ ...actor, role: 'administrator' }, 7);
      assert.equal(data.campaigns.length, 10);
      assert.equal(data.campaignRowsTotal, 15);
      assert.equal(data.pages.length, 10);
      assert.equal(data.pageRowsTotal, 14);
      assert.equal(data.activity.newCampaigns, 12);
      assert.equal(data.activity.arrivals, 22);
      assert.equal(data.activity.consultations, 31);
      const serialized = JSON.stringify(data);
      for (const privateValue of ['@example.test', 'private-campaign-token', 'private-unsubscribe-token', 'Nom privé', 'Sujet privé', 'email_hash', 'linkEncrypted', 'unsubscribe']) {
        assert(!serialized.includes(privateValue), `Aggregate leaked ${privateValue}`);
      }
    });
    await t.test('MCP tool executes complete database aggregates for both connector transports and all periods', async () => {
      let executions = 0;
      for (const transport of [undefined, 'oauth'] as const) {
        const access: AgentAccess = { actor, tokenId: randomUUID(), scopes: ['read'], transport };
        for (const days of [7, 30, 90] as const) {
          const result = await callAgentTool(access, 'calas_outreach_analytics', { days }, async () => { executions++; }) as DashboardMetrics;
          const expected = await getDashboardMetrics(actor, days);
          assert.equal(result.period.days, days);
          assert.equal(result.daily.length, days);
          assert(result.activity.accepted > 1000, 'MCP must return full aggregates, not the recent-delivery excerpt');
          assert.equal(result.campaignRowsTotal, 15);
          assert.equal(result.campaigns.length, 10);
          const { generatedAt: resultAt, ...resultMetrics } = result;
          const { generatedAt: expectedAt, ...expectedMetrics } = expected;
          assert(Number.isFinite(Date.parse(resultAt)) && Number.isFinite(Date.parse(expectedAt)));
          assert.deepEqual(resultMetrics, expectedMetrics);
        }
        const defaults = await callAgentTool(access, 'calas_outreach_analytics', {}) as DashboardMetrics;
        assert.equal(defaults.period.days, 30);
      }
      assert.equal(executions, 6, 'Each valid invocation executes its permission/audit hook once');
    });
    await t.test('campaign filter isolates outcomes, queues, calendar, pages and retained recipients', async () => {
      const one = await getDashboardMetrics(actor, 7, bulk);
      const two = await getDashboardMetrics(actor, 7, boundary);
      const three = await getDashboardMetrics(actor, 7, paused);
      assert.equal(one.campaign?.id, bulk);
      assert.equal(one.campaign?.linkPath, '/r/' + campaignTokens.get(bulk));
      assert.equal(two.campaign?.linkPath, '/r/' + campaignTokens.get(boundary));
      assert.notEqual(one.campaign?.linkPath, two.campaign?.linkPath);
      assert.equal(one.campaign?.targetPath, two.campaign?.targetPath, 'Separate campaign links can share a destination');
      assert.equal(one.campaign?.recipientCount, 1001);
      assert.equal(two.campaign?.recipientCount, 14);
      assert.equal(one.activity.accepted, 1001);
      assert.equal(two.activity.accepted, 2);
      assert.equal(one.activity.requested, 0);
      assert.equal(two.activity.requested, 7);
      assert.equal(one.activity.arrivals, 8);
      assert.equal(two.activity.arrivals, 2);
      assert.equal(two.activity.consultations, 4);
      assert.deepEqual(one.current.queue, { waiting: 0, sending: 0, paused: 0 });
      assert.deepEqual(two.current.queue, { waiting: 1, sending: 1, paused: 0 });
      assert.deepEqual(three.current.queue, { waiting: 0, sending: 1, paused: 1 });
      assert.deepEqual(three.current.campaigns, { total: 1, drafts: 0, active: 0, paused: 1 });
      assert.deepEqual(two.pages, [{ path: '/contact/', title: 'Contact', arrivals: 2, consultations: 4 }]);
      assert.equal(two.daily.reduce((sum, day) => sum + day.accepted, 0), 2);
      assert.equal(two.daily.reduce((sum, day) => sum + day.consultations, 0), 4);
      for (const selected of [one, two, three]) {
        assert.equal(selected.campaignRowsTotal, 1);
        assert.equal(selected.campaigns.length, 1);
        assert.equal(selected.campaigns[0].id, selected.campaign?.id);
        assert.equal(selected.activity.newCampaigns, 0);
        assert.equal(selected.current.contacts, null);
        assert.equal(selected.activity.newContacts, null);
        assert.equal(selected.activity.responsesRecorded, null);
        assert.equal(selected.activity.exclusionsAdded, null);
        const serialized = JSON.stringify(selected);
        for (const privateValue of ['@example.test', 'private-unsubscribe-token', 'Nom privé', 'Sujet privé', 'email_hash', 'linkEncrypted', 'unsubscribe']) assert(!serialized.includes(privateValue));
      }
    });
    const inactive = await campaign('Archive ancienne sans activité', 'draft');
    const literal = await campaign('Littéral 100%_!', 'draft');
    await campaign('Littéral 100xy!', 'draft');
    await t.test('campaign selector paginates all campaigns and searches wildcard characters literally', async () => {
      const defaults = await getDashboardCampaignOptions(actor);
      assert.equal(defaults.total, 18);
      assert.equal(defaults.offset, 0);
      assert.equal(defaults.limit, 20);
      assert.equal(defaults.items.length, 18);
      assert(defaults.items.some(item => item.id === inactive), 'Old inactive campaigns remain selectable');
      const first = await getDashboardCampaignOptions(actor, { offset: '0', limit: '5' });
      const next = await getDashboardCampaignOptions(actor, { offset: 5, limit: 5 });
      assert.equal(first.total, 18);
      assert.equal(next.total, 18);
      assert.deepEqual([...first.items, ...next.items].map(item => item.id), defaults.items.slice(0, 10).map(item => item.id));
      const beyond = await getDashboardCampaignOptions(actor, { offset: 100 });
      assert.equal(beyond.total, 18);
      assert.deepEqual(beyond.items, []);
      for (const q of ['%', '_', '100%_!', 'littéral 100%_!', '  Littéral 100%_!  ']) {
        const found = await getDashboardCampaignOptions(actor, { q });
        assert.equal(found.total, 1);
        assert.equal(found.items[0].id, literal);
      }
      assert.equal((await getDashboardCampaignOptions(actor, { q: 'nonexistent-title' })).total, 0);
      assert(defaults.items.every(item => !('linkPath' in item) && !('linkEncrypted' in item) && !('recipientCount' in item)));
    });
    await t.test('inactive campaign returns explicit zero data while an unknown campaign is 404', async () => {
      const data = await getDashboardMetrics(actor, 90, inactive);
      assert.equal(data.campaign?.id, inactive);
      assert.equal(data.campaign?.recipientCount, 0);
      assert.equal(data.activity.accepted, 0);
      assert.equal(data.activity.newCampaigns, 0);
      assert.deepEqual(data.current.campaigns, { total: 1, drafts: 1, active: 0, paused: 0 });
      assert.equal(data.campaignRowsTotal, 1);
      assert.equal(data.campaigns.length, 1);
      assert(data.daily.every(day => !day.accepted && !day.arrivals && !day.consultations));
      assert.deepEqual(data.pages, []);
      await assert.rejects(() => getDashboardMetrics(actor, 7, randomUUID()), { status: 404, code: 'NOT_FOUND' });
    });
    await t.test('two real campaign tokens attribute arrivals to separate campaigns on the same page', async () => {
      await getPool().query("SET TIME ZONE 'UTC'");
      const campaignA = await campaign('Lien A réel', 'active', true), campaignB = await campaign('Lien B réel', 'active', true);
      const tokenA = campaignTokens.get(campaignA)!, tokenB = campaignTokens.get(campaignB)!;
      assert.notEqual(tokenA, tokenB);
      assert.equal((await getCampaignLanding(tokenA))?.campaignId, campaignA);
      assert.equal((await getCampaignLanding(tokenB))?.campaignId, campaignB);
      await recordCampaignVisit(tokenA, '/contact/', true);
      await recordCampaignVisit(tokenA, '/contact/', true);
      await recordCampaignVisit(tokenA, '/reflexions/');
      await recordCampaignVisit(tokenB, '/contact/', true);
      const a = await getDashboardMetrics(actor, 7, campaignA), b = await getDashboardMetrics(actor, 7, campaignB);
      assert.deepEqual(a.pages, [{ path: '/contact/', title: 'Contact', arrivals: 2, consultations: 2 }, { path: '/reflexions/', title: 'Réflexions', arrivals: 0, consultations: 1 }]);
      assert.deepEqual(b.pages, [{ path: '/contact/', title: 'Contact', arrivals: 1, consultations: 1 }]);
      assert.equal(a.activity.arrivals, 2);
      assert.equal(a.activity.consultations, 3);
      assert.equal(b.activity.arrivals, 1);
      assert.equal(b.activity.consultations, 1);
      assert.equal(a.activity.newCampaigns, 1);
      assert.equal(b.activity.newCampaigns, 1);
      assert.equal(a.daily.at(-1)?.arrivals, 2);
      assert.equal(b.daily.at(-1)?.arrivals, 1);
      for (const transport of [undefined, 'oauth'] as const) {
        const access: AgentAccess = { actor, tokenId: randomUUID(), scopes: ['read'], transport };
        const options = await callAgentTool(access, 'calas_outreach_campaigns', { q: 'Lien', limit: 1 }) as DashboardCampaignOptions;
        assert.equal(options.total, 2);
        assert.equal(options.items.length, 1);
        const selected = await callAgentTool(access, 'calas_outreach_analytics', { days: 7, campaignId: campaignB }) as DashboardMetrics;
        assert.equal(selected.campaign?.id, campaignB);
        assert.equal(selected.campaign?.linkPath, '/r/' + tokenB);
        assert.equal(selected.activity.arrivals, 1);
        assert.equal(selected.activity.consultations, 1);
        assert.equal(selected.current.contacts, null);
        await assert.rejects(() => callAgentTool(access, 'calas_outreach_analytics', { campaignId: randomUUID() }), { status: 404 });
      }
    });
    await t.test('custom range includes both UTC days and excludes the following midnight', async () => {
      const custom = await campaign('Bornes personnalisées', 'active', true);
      await delivery(custom,'smtp','accepted','2024-02-28T23:59:59.999Z','2024-02-28T23:59:59.999Z');
      await delivery(custom,'smtp','accepted','2024-02-29T00:00:00.000Z','2024-02-29T00:00:00.000Z');
      await delivery(custom,'smtp','accepted','2024-02-29T23:59:59.999Z','2024-02-29T23:59:59.999Z');
      await delivery(custom,'smtp','accepted','2024-03-01T00:00:00.000Z','2024-03-01T00:00:00.000Z');
      await getPool().query("SET TIME ZONE 'Europe/Paris'");
      await getPool().query("INSERT INTO outreach_campaign_visits(campaign_id,path,day,arrivals,visits) VALUES($1,'/contact/','2024-02-28',1,3),($1,'/contact/','2024-02-29',2,5),($1,'/contact/','2024-03-01',7,12)",[custom]);
      const leap = await getDashboardMetrics(actor,undefined,custom,{from:'2024-02-29',to:'2024-02-29'});
      assert.deepEqual(leap.period,{days:1,from:'2024-02-29',to:'2024-02-29',timeZone:'UTC'});
      assert.equal(leap.activity.accepted,2);assert.equal(leap.activity.requested,2);
      assert.deepEqual(leap.daily,[{day:'2024-02-29',accepted:2,arrivals:2,consultations:5}]);
      assert.equal(leap.activity.newCampaigns,0,'Current campaigns are not new within a historical range');
      const previous = await getDashboardMetrics(actor,undefined,custom,{from:'2024-02-28',to:'2024-02-28'});
      assert.equal(previous.activity.accepted,1);assert.equal(previous.activity.consultations,3);
      const combined = await getDashboardMetrics(actor,undefined,custom,{from:'2024-02-28',to:'2024-03-01'});
      assert.equal(combined.daily.length,3);assert.equal(combined.activity.accepted,4);assert.equal(combined.activity.consultations,20);
      const bulkCustom = await getDashboardMetrics(actor,undefined,bulk,{from:times.today,to:times.today});
      assert.equal(bulkCustom.activity.accepted,1001,'Custom periods keep complete aggregates over 1000 records');
      for(const transport of [undefined,'oauth'] as const) {
        const access: AgentAccess={actor,tokenId:randomUUID(),scopes:['read'],transport};
        const result=await callAgentTool(access,'calas_outreach_analytics',{campaignId:custom,from:'2024-02-29',to:'2024-02-29'}) as DashboardMetrics;
        assert.deepEqual(result.period,leap.period);assert.deepEqual(result.activity,leap.activity);assert.deepEqual(result.daily,leap.daily);
      }
    });
  } finally {
    await closeDatabase();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await control.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await control.end();
  }
});
