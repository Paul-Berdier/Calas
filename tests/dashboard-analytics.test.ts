import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closeDatabase, getDb, getPool } from '../apps/web/src/server/db';
import { dashboardPeriod, getDashboardMetrics } from '../apps/web/src/server/outreach/analytics';
import { availableAgentTools, callAgentTool } from '../apps/web/src/server/agent/tools';
import type { AgentAccess } from '../apps/web/src/server/agent/access';
import type { Actor } from '../apps/web/src/server/auth/permissions';
import type { DashboardMetrics } from '../apps/web/src/lib/dashboard-metrics';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(resolve(root, 'apps/web/package.json'));
const { Pool } = require('pg');
const { migrate } = await import(pathToFileURL(require.resolve('drizzle-orm/node-postgres/migrator')).href);
try { loadEnvFile(resolve(root, 'apps/web/.env')); } catch { /* Runner may provide environment. */ }
const actor: Actor = { id: randomUUID(), name: 'Recette statistiques', email: 'analytics@example.test', role: 'editor' };

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
  for (const args of [{ days: 8 }, { days: '7' }, { days: null }, { days: 30, recipient: 'private@example.test' }]) {
    await assert.rejects(() => callAgentTool(access, tool.name, args, beforeExecution), { status: 422, code: 'VALIDATION' });
  }
  assert.equal(executions, 0, 'Rejected MCP requests must never execute an aggregate or its audit hook');
});

test('dashboard aggregates use complete, isolated PostgreSQL data', { skip: process.env.RUN_OUTREACH_INTEGRATION !== '1' }, async t => {
  const source = new URL(process.env.DATABASE_URL!);
  assert(['127.0.0.1', 'localhost'].includes(source.hostname), 'Only a local test database is allowed');
  const name = `calas_dashboard_test_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString: source.href, max: 1 });
  await control.query(`CREATE DATABASE "${name}"`);
  const previous = Object.fromEntries(['DATABASE_URL', 'DATABASE_POOL_MAX', 'OUTREACH_MAIL_TRANSPORT', 'OUTREACH_RUNNER_ENABLED', 'OUTREACH_MAX_PER_HOUR'].map(key => [key, process.env[key]]));
  const isolated = new URL(source); isolated.pathname = `/${name}`;
  process.env.DATABASE_URL = isolated.href;
  process.env.DATABASE_POOL_MAX = '1';
  process.env.OUTREACH_MAIL_TRANSPORT = 'smtp';
  process.env.OUTREACH_RUNNER_ENABLED = 'true';
  process.env.OUTREACH_MAX_PER_HOUR = '40';
  const campaign = async (title: string, status = 'active', recent = false) => {
    const id = randomUUID();
    await getPool().query(`INSERT INTO outreach_campaigns(id,title,subject,body,target_path,status,link_hash,link_encrypted,created_by,created_at)
      VALUES($1::uuid,$2,'Sujet privé','Corps privé','/contact/',$3,$1::text,'private-campaign-token',$4,now()-CASE WHEN $5 THEN interval '0 days' ELSE interval '100 days' END)`, [id, title, status, actor.id, recent]);
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
  } finally {
    await closeDatabase();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await control.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await control.end();
  }
});
