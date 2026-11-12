import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { OperationsStatus } from '../../lib/operations-status';
import type { Actor } from '../auth/permissions';
import { getPool } from '../db';
import { HttpError } from '../http';

const day = 86_400_000;
const backupStages = new Set(['configuration', 'connexion-base', 'capture-distante', 'signalement', 'delai']);
type Markers = { success: unknown; failure: unknown };
type MailActivity = Pick<OperationsStatus['mail'], 'lastAcceptedAt' | 'lastFailedAt' | 'failed24h' | 'uncertain' | 'waiting'>;
type Dependencies = { now?: Date; readMarkers?: () => Promise<Markers | null>; probe?: () => Promise<boolean>; mailActivity?: () => Promise<MailActivity> };

export function expectedBackupDay(now: Date) {
  const midnight = Date.parse(now.toISOString().slice(0, 10) + 'T00:00:00Z');
  // Existing backup: 06:00 UTC, with the same one-hour grace as the monitor.
  return new Date(now.getTime() >= midnight + 7 * 3_600_000 ? midnight : midnight - day).toISOString().slice(0, 10);
}

export function inspectBackupMarkers(markers: Markers | null, now: Date): OperationsStatus['backup'] {
  const result: OperationsStatus['backup'] = { status: 'unknown', capturedAt: null, verifiedAt: null, failedAt: null, expectedDay: expectedBackupDay(now) };
  if (!markers) return { ...result, status: 'unconfigured' };
  const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now.getTime() + 300_000;
  const success = markers.success as Record<string, unknown> | null;
  const failure = markers.failure as Record<string, unknown> | null;
  if (success && (success.version !== 1 || !timestamp(success.capturedAt) || !timestamp(success.verifiedAt) ||
    new Date(success.capturedAt).toISOString().slice(0, 10) !== success.day || Date.parse(success.verifiedAt) < Date.parse(success.capturedAt))) return result;
  if (failure && (failure.version !== 1 || !timestamp(failure.failedAt) || !backupStages.has(String(failure.stage)))) return result;
  result.capturedAt = success ? String(success.capturedAt) : null;
  result.verifiedAt = success ? String(success.verifiedAt) : null;
  result.failedAt = failure ? String(failure.failedAt) : null;
  if (result.failedAt && (!result.verifiedAt || Date.parse(result.failedAt) > Date.parse(result.verifiedAt))) return { ...result, status: 'error' };
  if (!success || String(success.day) < result.expectedDay) return { ...result, status: 'late' };
  return { ...result, status: 'ok' };
}

async function limitedText(response: Response, limit: number) {
  if (!response.body) throw new Error('Empty response');
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > limit) throw new Error('Response too large');
      chunks.push(next.value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { await reader.cancel().catch(() => {}); }
}

/** Only the operator-configured canonical origin is probed; no user URL is accepted. */
export async function probePublicSite(fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const url = new URL(process.env.SITE_URL || '');
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      !(url.protocol === 'https:' || (process.env.SITE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) return false;
    const checks = await Promise.all(['/api/ready/', '/'].map(async path => {
      const response = await fetcher(new URL(path, url), { redirect: 'manual', signal: AbortSignal.timeout(6_000), headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Calas-Admin-Status/1' } });
      if (response.status !== 200) { await response.body?.cancel(); return false; }
      const type = response.headers.get('content-type') || '';
      const text = await limitedText(response, path === '/' ? 1_048_576 : 4096);
      return path === '/' ? type.includes('text/html') && /<main(?:\s|>)/i.test(text) && /<h1(?:\s|>)/i.test(text)
        : type.includes('application/json') && JSON.parse(text).status === 'ready';
    }));
    return checks.every(Boolean);
  } catch { return false; }
}

async function readBackupMarkers(): Promise<Markers | null> {
  const keys = ['ENDPOINT', 'BUCKET', 'ACCESS_KEY_ID', 'SECRET_ACCESS_KEY'];
  if (keys.every(key => !process.env['STATUS_S3_' + key])) return null;
  if (keys.some(key => !process.env['STATUS_S3_' + key])) throw new Error('Incomplete monitoring configuration');
  const endpoint = new URL(process.env.STATUS_S3_ENDPOINT!);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Invalid monitoring storage');
  const client = new S3Client({ endpoint: endpoint.href, region: process.env.STATUS_S3_REGION || 'auto', forcePathStyle: process.env.STATUS_S3_FORCE_PATH_STYLE === 'true',
    credentials: { accessKeyId: process.env.STATUS_S3_ACCESS_KEY_ID!, secretAccessKey: process.env.STATUS_S3_SECRET_ACCESS_KEY! },
    maxAttempts: 1, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  async function marker(key: 'success' | 'failure') {
    try {
      const response = await client.send(new GetObjectCommand({ Bucket: process.env.STATUS_S3_BUCKET!, Key: 'backup/' + key + '.json' }), { abortSignal: AbortSignal.timeout(5_000) });
      if (!response.Body) throw new Error('Missing marker');
      // Read bounded bytes even if the remote Content-Length is misleading.
      return JSON.parse(await limitedText(new Response(response.Body.transformToWebStream()), 2048));
    } catch (error) {
      if (['NoSuchKey', 'NotFound'].includes((error as Error).name)) return null;
      throw error;
    }
  }
  try { const [success, failure] = await Promise.all([marker('success'), marker('failure')]); return { success, failure }; }
  finally { client.destroy(); }
}

async function readMailActivity(): Promise<MailActivity> {
  const { rows } = await getPool().query<MailActivity>(`SELECT
    max(finished_at) FILTER(WHERE status='accepted' AND transport='smtp') AS "lastAcceptedAt",
    max(finished_at) FILTER(WHERE status='failed' AND transport='smtp') AS "lastFailedAt",
    count(*) FILTER(WHERE status='failed' AND transport='smtp' AND finished_at>=now()-interval '24 hours')::int AS "failed24h",
    count(*) FILTER(WHERE status='uncertain' AND transport='smtp')::int AS uncertain,
    count(*) FILTER(WHERE status IN ('queued','sending'))::int AS waiting FROM outreach_deliveries`);
  return rows[0];
}

export async function getOperationsStatus(actor: Actor, dependencies: Dependencies = {}): Promise<OperationsStatus> {
  if (!actor || !['editor', 'administrator'].includes(actor.role)) throw new HttpError(403, 'FORBIDDEN', 'Accès réservé à l’équipe éditoriale.');
  const now = dependencies.now || new Date();
  const [site, markers, mail] = await Promise.allSettled([
    (dependencies.probe || probePublicSite)(), (dependencies.readMarkers || readBackupMarkers)(), (dependencies.mailActivity || readMailActivity)(),
  ]);
  const mode = process.env.OUTREACH_MAIL_TRANSPORT || 'simulation';
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    checkedAt: now.toISOString(),
    site: { status: site.status === 'fulfilled' && site.value ? 'ok' : 'error', checkedAt: now.toISOString() },
    backup: markers.status === 'fulfilled' ? inspectBackupMarkers(markers.value, now) : { status: 'unknown', capturedAt: null, verifiedAt: null, failedAt: null, expectedDay: expectedBackupDay(now) },
    mail: {
      mode: ['smtp', 'simulation', 'local'].includes(mode) ? mode as OperationsStatus['mail']['mode'] : 'unknown',
      configured: mode === 'smtp' && process.env.ALLOW_REAL_EMAIL === 'true' && Number.isInteger(port) && port > 0 && port <= 65535 && ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].every(key => Boolean(process.env[key])),
      workerEnabled: process.env.OUTREACH_RUNNER_ENABLED === 'true',
      ...(mail.status === 'fulfilled' ? mail.value : { lastAcceptedAt: null, lastFailedAt: null, failed24h: null, uncertain: null, waiting: null }),
    },
  };
}
