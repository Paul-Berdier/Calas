import type { DashboardMetrics, DashboardPeriod } from '../../lib/dashboard-metrics';
import type { Actor } from '../auth/permissions';
import { getPool } from '../db';
import { HttpError } from '../http';
import { outreachTransport } from './service';

export function dashboardPeriod(value: unknown = 30): DashboardPeriod {
  if (value === 7 || value === 30 || value === 90) return value;
  if (value === '7' || value === '30' || value === '90') return Number(value) as DashboardPeriod;
  throw new HttpError(422, 'PERIOD', 'Choisissez une période de 7, 30 ou 90 jours.');
}

const deliverySums = `
  count(*) FILTER (WHERE requested)::int AS requested,
  count(*) FILTER (WHERE terminal AND transport='smtp' AND status='accepted')::int AS accepted,
  count(*) FILTER (WHERE terminal AND transport='smtp' AND status='failed')::int AS failed,
  count(*) FILTER (WHERE terminal AND transport='smtp' AND status='uncertain')::int AS uncertain,
  count(*) FILTER (WHERE terminal AND transport='smtp' AND status='suppressed')::int AS suppressed,
  count(*) FILTER (WHERE terminal AND transport='simulation' AND status='simulated')::int AS simulated,
  count(*) FILTER (WHERE terminal AND transport='local' AND status='accepted')::int AS "localAccepted"`;

/** One statement gives every aggregate the same database snapshot and UTC clock. */
export async function getDashboardMetrics(actor: Actor, requestedDays: unknown = 30): Promise<DashboardMetrics> {
  if (!actor || !['editor', 'administrator'].includes(actor.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Accès réservé à l’équipe éditoriale.');
  }
  const days = dashboardPeriod(requestedDays);
  const transport = outreachTransport();
  const { rows } = await getPool().query<{ metrics: DashboardMetrics }>(`
    WITH clock AS (SELECT now() AS at), bounds AS (
      SELECT at, (at AT TIME ZONE 'UTC')::date AS today,
        (at AT TIME ZONE 'UTC')::date-($1::int-1) AS first_day FROM clock
    ), deliveries AS (
      SELECT d.campaign_id,d.transport,d.status,d.finished_at,
        d.transport='smtp' AND d.created_at >= (b.first_day::timestamp AT TIME ZONE 'UTC')
          AND d.created_at <= b.at AS requested,
        d.status IN ('accepted','failed','uncertain','suppressed','simulated')
          AND d.finished_at >= (b.first_day::timestamp AT TIME ZONE 'UTC')
          AND d.finished_at <= b.at AS terminal
      FROM outreach_deliveries d CROSS JOIN bounds b
    ), delivery_totals AS (SELECT ${deliverySums} FROM deliveries),
    delivery_campaigns AS (SELECT campaign_id,${deliverySums} FROM deliveries GROUP BY campaign_id),
    visits AS (
      SELECT v.campaign_id,v.path,v.day,v.arrivals,v.visits
      FROM outreach_campaign_visits v CROSS JOIN bounds b WHERE v.day BETWEEN b.first_day AND b.today
    ), visit_campaigns AS (
      SELECT campaign_id,sum(arrivals)::int AS arrivals,sum(visits)::int AS consultations FROM visits GROUP BY campaign_id
    ), campaign_rows AS (
      SELECT c.id,c.title,c.status,c.target_path AS "targetPath",
        coalesce(d.requested,0) AS requested,coalesce(d.accepted,0) AS accepted,
        coalesce(d.failed,0) AS failed,coalesce(d.uncertain,0) AS uncertain,
        coalesce(d.suppressed,0) AS suppressed,coalesce(d.simulated,0) AS simulated,
        coalesce(d."localAccepted",0) AS "localAccepted",
        coalesce(v.arrivals,0) AS arrivals,coalesce(v.consultations,0) AS consultations
      FROM outreach_campaigns c CROSS JOIN bounds b
      LEFT JOIN delivery_campaigns d ON d.campaign_id=c.id LEFT JOIN visit_campaigns v ON v.campaign_id=c.id
      WHERE (c.created_at >= (b.first_day::timestamp AT TIME ZONE 'UTC') AND c.created_at<=b.at)
        OR coalesce(d.requested+d.accepted+d.failed+d.uncertain+d.suppressed+d.simulated+d."localAccepted",0)>0
        OR coalesce(v.consultations,0)>0
    ), page_totals AS (
      SELECT path,sum(arrivals)::int AS arrivals,sum(visits)::int AS consultations FROM visits GROUP BY path
    ), public_titles AS (
      SELECT CASE WHEN p.slug='' THEN '/' ELSE '/'||p.slug||'/' END AS path,d.internal_title AS title
      FROM pages p JOIN content_documents d ON d.id=p.id WHERE d.status='published' AND d.published_revision_id IS NOT NULL
      UNION ALL SELECT '/reflexions/'||a.slug||'/',d.internal_title
      FROM articles a JOIN content_documents d ON d.id=a.id WHERE d.status='published' AND d.published_revision_id IS NOT NULL
    ), page_rows AS (
      SELECT p.path,coalesce((SELECT min(t.title) FROM public_titles t WHERE t.path=p.path),
        CASE p.path WHEN '/contact/' THEN 'Contact' WHEN '/reflexions/' THEN 'Réflexions' ELSE p.path END) AS title,
        p.arrivals,p.consultations FROM page_totals p
    ), daily_deliveries AS (
      SELECT (finished_at AT TIME ZONE 'UTC')::date AS day,count(*)::int AS accepted
      FROM deliveries WHERE terminal AND transport='smtp' AND status='accepted' GROUP BY 1
    ), daily_visits AS (
      SELECT day,sum(arrivals)::int AS arrivals,sum(visits)::int AS consultations FROM visits GROUP BY day
    ), calendar AS (
      SELECT b.first_day+g.n AS day FROM bounds b CROSS JOIN generate_series(0,$1::int-1) AS g(n)
    ), daily_rows AS (
      SELECT c.day::text AS day,coalesce(d.accepted,0) AS accepted,
        coalesce(v.arrivals,0) AS arrivals,coalesce(v.consultations,0) AS consultations
      FROM calendar c LEFT JOIN daily_deliveries d USING(day) LEFT JOIN daily_visits v USING(day)
    )
    SELECT json_build_object(
      'generatedAt',b.at,
      'period',json_build_object('days',$1::int,'from',b.first_day::text,'to',b.today::text,'timeZone','UTC'),
      'current',json_build_object(
        'contacts',(SELECT json_build_object('total',count(*)::int,
          'eligible',count(*) FILTER (WHERE p.status='active' AND p.retention_until>b.at
            AND NOT EXISTS(SELECT 1 FROM outreach_suppressions s WHERE s.email_hash=p.email_hash))::int,
          'responded',count(*) FILTER (WHERE p.status='responded')::int,
          'excluded',(SELECT count(*)::int FROM outreach_suppressions)) FROM outreach_prospects p),
        'campaigns',(SELECT json_build_object('total',count(*)::int,'drafts',count(*) FILTER(WHERE status='draft')::int,
          'active',count(*) FILTER(WHERE status='active')::int,'paused',count(*) FILTER(WHERE status='paused')::int) FROM outreach_campaigns),
        'queue',(SELECT json_build_object('waiting',count(*) FILTER(WHERE d.status='queued' AND c.status<>'paused')::int,
          'sending',count(*) FILTER(WHERE d.status='sending')::int,
          'paused',count(*) FILTER(WHERE d.status='queued' AND c.status='paused')::int)
          FROM outreach_deliveries d JOIN outreach_campaigns c ON c.id=d.campaign_id)),
      'activity',(SELECT row_to_json(t) FROM (SELECT dt.*,
        (SELECT count(*)::int FROM outreach_prospects WHERE created_at >= (b.first_day::timestamp AT TIME ZONE 'UTC') AND created_at<=b.at) AS "newContacts",
        (SELECT count(*)::int FROM outreach_campaigns WHERE created_at >= (b.first_day::timestamp AT TIME ZONE 'UTC') AND created_at<=b.at) AS "newCampaigns",
        (SELECT count(*)::int FROM outreach_prospects WHERE last_response_at >= (b.first_day::timestamp AT TIME ZONE 'UTC') AND last_response_at<=b.at) AS "responsesRecorded",
        (SELECT count(*)::int FROM outreach_suppressions WHERE created_at >= (b.first_day::timestamp AT TIME ZONE 'UTC') AND created_at<=b.at) AS "exclusionsAdded",
        (SELECT coalesce(sum(arrivals),0)::int FROM visits) AS arrivals,
        (SELECT coalesce(sum(visits),0)::int FROM visits) AS consultations FROM delivery_totals dt) t),
      'daily',(SELECT coalesce(json_agg(t ORDER BY t.day),'[]'::json) FROM daily_rows t),
      'campaigns',(SELECT coalesce(json_agg(t ORDER BY t.arrivals DESC,t.accepted DESC,t.title,t.id),'[]'::json)
        FROM (SELECT * FROM campaign_rows ORDER BY arrivals DESC,accepted DESC,title,id LIMIT 10) t),
      'campaignRowsTotal',(SELECT count(*)::int FROM campaign_rows),
      'pages',(SELECT coalesce(json_agg(t ORDER BY t.consultations DESC,t.arrivals DESC,t.path),'[]'::json)
        FROM (SELECT * FROM page_rows ORDER BY consultations DESC,arrivals DESC,path LIMIT 10) t),
      'pageRowsTotal',(SELECT count(*)::int FROM page_rows)
    ) AS metrics FROM bounds b`, [days]);
  const metrics = rows[0].metrics;
  return {
    ...metrics,
    current: {
      ...metrics.current,
      transport,
      workerEnabled: process.env.OUTREACH_RUNNER_ENABLED === 'true',
      hourlyLimit: Math.max(1, Math.min(10000, Number(process.env.OUTREACH_MAX_PER_HOUR) || 20)),
    },
  };
}
