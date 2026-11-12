import { z } from 'zod';
import type { CampaignPreview, DeliveryHistoryItem, ManagedCampaign, ManagedProspect, MessageTemplate, OutreachPage } from '../../lib/outreach-management';
import type { Actor } from '../auth/permissions';
import { getPool } from '../db';
import { HttpError } from '../http';
import { mailContent, siteOrigin } from './mail';
import { getPublicTargets } from './service';
import { unseal } from './tokens';
import { campaignPreviewSchema, messageTemplateDeleteSchema, messageTemplateInputSchema, messageTemplateUpdateSchema, uuidSchema, validated } from './validation';

function checkActor(actor: Actor) {
  if (!actor || !['editor', 'administrator'].includes(actor.role)) throw new HttpError(403, 'FORBIDDEN', 'Un accès de gestion est nécessaire.');
}
type SearchOptions = { q?: unknown; offset?: unknown; limit?: unknown };
function integer(value: unknown, fallback: number, max: number, min = 0) {
  if (value === undefined) return fallback;
  const parsed = typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new HttpError(422, 'PAGINATION', 'La pagination demandée est invalide.');
  return parsed;
}
function searchOptions(options: SearchOptions) {
  if (options.q !== undefined && (typeof options.q !== 'string' || options.q.length > 100)) throw new HttpError(422, 'SEARCH', 'La recherche est limitée à 100 caractères.');
  const q = typeof options.q === 'string' ? options.q.trim() : '';
  return { pattern: `%${q.replace(/[!%_]/g, '!$&')}%`, offset: integer(options.offset, 0, 2147483647), limit: integer(options.limit, 50, 100, 1) };
}
function optionalId(value: unknown) { return value === undefined ? null : validated(uuidSchema, value); }
function optionalStatus(value: unknown, choices: readonly string[]) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !choices.includes(value)) throw new HttpError(422, 'STATUS', 'Choisissez un état valide.');
  return value;
}
async function assertCampaign(id: string | null) {
  if (id && !(await getPool().query('SELECT id FROM outreach_campaigns WHERE id=$1', [id])).rowCount) throw new HttpError(404, 'NOT_FOUND', 'Campagne introuvable.');
}

/** Count and items use one database snapshot, independently of the old overview excerpts. */
export async function getDeliveryHistory(actor: Actor, options: SearchOptions & { campaignId?: unknown; status?: unknown } = {}): Promise<OutreachPage<DeliveryHistoryItem>> {
  checkActor(actor);
  const { pattern, offset, limit } = searchOptions(options), campaignId = optionalId(options.campaignId);
  const status = optionalStatus(options.status, ['queued', 'sending', 'accepted', 'simulated', 'failed', 'uncertain', 'suppressed']);
  await assertCampaign(campaignId);
  const { rows } = await getPool().query<{ result: OutreachPage<DeliveryHistoryItem> }>(`
    WITH matching AS (
      SELECT d.id,d.campaign_id AS "campaignId",c.title AS "campaignTitle",d.contact_id AS "contactId",
        d.email,p.company,d.status,d.transport,d.attempts,d.created_at AS "createdAt",d.finished_at AS "finishedAt",
        d.scheduled_at AS "scheduledAt",d.next_attempt_at AS "nextAttemptAt"
      FROM outreach_deliveries d JOIN outreach_campaigns c ON c.id=d.campaign_id JOIN outreach_prospects p ON p.id=d.contact_id
      WHERE ($1::uuid IS NULL OR d.campaign_id=$1) AND ($2::text IS NULL OR d.status=$2)
        AND (d.email ILIKE $3 ESCAPE '!' OR p.company ILIKE $3 ESCAPE '!' OR c.title ILIKE $3 ESCAPE '!')
    ), items AS (SELECT * FROM matching ORDER BY "createdAt" DESC,id DESC LIMIT $4 OFFSET $5)
    SELECT json_build_object('items',(SELECT coalesce(json_agg(i ORDER BY i."createdAt" DESC,i.id DESC),'[]'::json) FROM items i),
      'total',(SELECT count(*)::int FROM matching),'offset',$5::int,'limit',$4::int) AS result`, [campaignId, status, pattern, limit, offset]);
  return rows[0].result;
}

export async function getOutreachContacts(actor: Actor, options: SearchOptions & { status?: unknown; campaignId?: unknown; eligibleOnly?: unknown } = {}): Promise<OutreachPage<ManagedProspect>> {
  checkActor(actor);
  const { pattern, offset, limit } = searchOptions(options), campaignId = optionalId(options.campaignId);
  const status = optionalStatus(options.status, ['active', 'responded', 'suppressed']);
  const eligibleOnly = options.eligibleOnly === true || options.eligibleOnly === 'true';
  if (options.eligibleOnly !== undefined && ![true, false, 'true', 'false'].includes(options.eligibleOnly as boolean | string)) throw new HttpError(422, 'FILTER', 'Le filtre de destinataires est invalide.');
  await assertCampaign(campaignId);
  const { rows } = await getPool().query<{ result: OutreachPage<ManagedProspect> }>(`
    WITH candidates AS (
      SELECT p.id,p.version,p.email,p.name,p.company,p.job_title AS "jobTitle",p.source,p.source_date::text AS "sourceDate",
        p.information_confirmed AS "informationConfirmed",p.status,p.last_response_at AS "lastResponseAt",p.created_at AS "createdAt",
        p.status='active' AND p.retention_until>now() AND NOT EXISTS(SELECT 1 FROM outreach_suppressions s WHERE s.email_hash=p.email_hash) AS eligible,
        EXISTS(SELECT 1 FROM outreach_deliveries d WHERE d.campaign_id=$2 AND d.contact_id=p.id) AS "alreadyIncluded"
      FROM outreach_prospects p WHERE ($1::text IS NULL OR p.status=$1)
        AND (p.email ILIKE $3 ESCAPE '!' OR p.company ILIKE $3 ESCAPE '!' OR p.name ILIKE $3 ESCAPE '!')
    ), matching AS (SELECT * FROM candidates WHERE NOT $4::boolean OR (eligible AND NOT "alreadyIncluded")),
    items AS (SELECT * FROM matching ORDER BY "createdAt" DESC,id DESC LIMIT $5 OFFSET $6)
    SELECT json_build_object('items',(SELECT coalesce(json_agg(i ORDER BY i."createdAt" DESC,i.id DESC),'[]'::json) FROM items i),
      'total',(SELECT count(*)::int FROM matching),'offset',$6::int,'limit',$5::int) AS result`, [status, campaignId, pattern, eligibleOnly, limit, offset]);
  return rows[0].result;
}

export async function getOutreachCampaigns(actor: Actor, options: SearchOptions & { status?: unknown } = {}): Promise<OutreachPage<ManagedCampaign>> {
  checkActor(actor);
  const { pattern, offset, limit } = searchOptions(options), status = optionalStatus(options.status, ['draft', 'active', 'paused']);
  type Stored = Omit<ManagedCampaign, 'linkPath'> & { linkEncrypted: string };
  const { rows } = await getPool().query<{ result: OutreachPage<Stored> }>(`
    WITH matching AS (
      SELECT id,version,title,subject,body,target_path AS "targetPath",status,link_encrypted AS "linkEncrypted",created_at AS "createdAt"
      FROM outreach_campaigns WHERE ($1::text IS NULL OR status=$1) AND (title ILIKE $2 ESCAPE '!' OR subject ILIKE $2 ESCAPE '!')
    ), items AS (SELECT * FROM matching ORDER BY "createdAt" DESC,id DESC LIMIT $3 OFFSET $4)
    SELECT json_build_object('items',(SELECT coalesce(json_agg(i ORDER BY i."createdAt" DESC,i.id DESC),'[]'::json) FROM items i),
      'total',(SELECT count(*)::int FROM matching),'offset',$4::int,'limit',$3::int) AS result`, [status, pattern, limit, offset]);
  return { ...rows[0].result, items: rows[0].result.items.map(({ linkEncrypted, ...item }) => ({ ...item, linkPath: '/r/' + unseal(linkEncrypted) })) };
}

/** Preview reuses the exact mail formatter, with an explicitly inert opposition example. */
export async function getCampaignPreview(id: string, value: unknown, actor: Actor): Promise<CampaignPreview> {
  checkActor(actor); validated(uuidSchema, id);
  const input = validated(campaignPreviewSchema, value);
  const campaign = (await getPool().query<{ subject: string; body: string; link_encrypted: string }>('SELECT subject,body,link_encrypted FROM outreach_campaigns WHERE id=$1', [id])).rows[0];
  if (!campaign) throw new HttpError(404, 'NOT_FOUND', 'Campagne introuvable.');
  const recipient = input.contactId ? (await getPool().query<{ id: string; email: string; source: string }>('SELECT id,email,source FROM outreach_prospects WHERE id=$1', [input.contactId])).rows[0] : null;
  if (input.contactId && !recipient) throw new HttpError(404, 'NOT_FOUND', 'Contact introuvable.');
  const campaignLink = '/r/' + unseal(campaign.link_encrypted);
  const text = mailContent({ id: 'preview', email: recipient?.email ?? 'exemple@example.test', subject: campaign.subject, body: campaign.body,
    source: recipient?.source ?? '[provenance propre à chaque destinataire]', transport: 'simulation',
    campaignLink, unsubscribeLink: '/r/exemple-desinscription/' });
  return { subject: campaign.subject, text, campaignLink: siteOrigin() + campaignLink, recipient: recipient ?? null, unsubscribeIsExample: true, sourceIsExample: !recipient };
}

const templateColumns = 'id,version,title,subject,body,target_path AS "targetPath",created_at AS "createdAt",updated_at AS "updatedAt"';
export async function getMessageTemplates(actor: Actor, options: SearchOptions = {}): Promise<OutreachPage<MessageTemplate>> {
  checkActor(actor);
  const { pattern, offset, limit } = searchOptions(options);
  const { rows } = await getPool().query<{ result: OutreachPage<MessageTemplate> }>(`
    WITH matching AS (SELECT ${templateColumns} FROM outreach_message_templates WHERE title ILIKE $1 ESCAPE '!' OR subject ILIKE $1 ESCAPE '!'),
    items AS (SELECT * FROM matching ORDER BY "createdAt" DESC,id DESC LIMIT $2 OFFSET $3)
    SELECT json_build_object('items',(SELECT coalesce(json_agg(i ORDER BY i."createdAt" DESC,i.id DESC),'[]'::json) FROM items i),
      'total',(SELECT count(*)::int FROM matching),'offset',$3::int,'limit',$2::int) AS result`, [pattern, limit, offset]);
  return rows[0].result;
}
async function assertTemplateTarget(targetPath: string) {
  if (!(await getPublicTargets()).some(target => target.path === targetPath)) throw new HttpError(422, 'TARGET', 'Choisissez une page actuellement publiée sur le site.');
}
async function templateMutation(actor: Actor, action: string, query: string, values: unknown[]): Promise<MessageTemplate> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<MessageTemplate>(query, values);
    if (!result.rowCount) throw new HttpError(409, 'CONFLICT', 'Ce modèle a changé ou a été supprimé. Rechargez la liste.');
    const item = result.rows[0];
    await client.query("INSERT INTO audit_logs(action,actor_id,actor_name,resource_type,resource_id,title,metadata) VALUES($1,$2,$3,'outreach',$4,'Modèle de message','{}')", [action, actor.id, actor.name, item.id]);
    await client.query('COMMIT');
    return item;
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
export async function createMessageTemplate(value: unknown, actor: Actor) {
  checkActor(actor); const input = validated(messageTemplateInputSchema, value); await assertTemplateTarget(input.targetPath);
  return templateMutation(actor, 'outreach.template.created', `INSERT INTO outreach_message_templates(title,subject,body,target_path,created_by) VALUES($1,$2,$3,$4,$5) RETURNING ${templateColumns}`, [input.title, input.subject, input.body, input.targetPath, actor.id]);
}
export async function updateMessageTemplate(id: string, value: unknown, actor: Actor) {
  checkActor(actor); validated(uuidSchema, id); const input = validated(messageTemplateUpdateSchema, value); await assertTemplateTarget(input.targetPath);
  return templateMutation(actor, 'outreach.template.updated', `UPDATE outreach_message_templates SET title=$1,subject=$2,body=$3,target_path=$4,version=version+1,updated_at=now() WHERE id=$5 AND version=$6 RETURNING ${templateColumns}`, [input.title, input.subject, input.body, input.targetPath, id, input.version]);
}
export async function deleteMessageTemplate(id: string, value: unknown, actor: Actor) {
  checkActor(actor); validated(uuidSchema, id); const input = validated(messageTemplateDeleteSchema, value);
  await templateMutation(actor, 'outreach.template.deleted', `DELETE FROM outreach_message_templates WHERE id=$1 AND version=$2 RETURNING ${templateColumns}`, [id, input.version]);
  return { ok: true };
}

// Export validation for direct consumers that do not pass through the HTTP route.
export const deliveryStatusSchema = z.enum(['queued', 'sending', 'accepted', 'simulated', 'failed', 'uncertain', 'suppressed']);
