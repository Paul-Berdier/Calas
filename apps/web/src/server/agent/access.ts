import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db';
import { agentTokens } from '../db/agent-schema';
import { oauthGrants } from '../db/oauth-schema';
import { securityEvents, session, user } from '../db/auth-schema';
import { hasRequiredAuthentication } from '../auth/access-policy';
import type { Actor } from '../auth/permissions';
import { HttpError } from '../http';

export const agentScopes = ['read', 'draft', 'publish', 'outreach', 'send', 'users'] as const;
export type AgentScope = typeof agentScopes[number];
export interface AgentAccess { actor: Actor; tokenId: string; scopes: AgentScope[]; transport?: 'oauth' }
export const createAgentTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(agentScopes)).min(1).max(6)
    .refine(values => values.includes('read') && new Set(values).size === values.length),
}).strict();

const publicToken = {
  id: agentTokens.id, name: agentTokens.name, scopes: agentTokens.scopes,
  createdAt: agentTokens.createdAt, expiresAt: agentTokens.expiresAt,
  lastUsedAt: agentTokens.lastUsedAt, revokedAt: agentTokens.revokedAt,
};
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const rejected = () => new HttpError(401, 'AGENT_ACCESS_EXPIRED', 'Cet accès a expiré ou a été révoqué. Reconnectez-vous à l’administration pour créer un nouvel accès.');

export async function listAgentTokens(actor: Actor) {
  return getDb().select(publicToken).from(agentTokens).where(eq(agentTokens.userId, actor.id)).orderBy(desc(agentTokens.createdAt)).limit(50);
}

export async function createAgentToken(actor: Actor, sessionId: string, input: z.infer<typeof createAgentTokenSchema>) {
  const value = createAgentTokenSchema.parse(input);
  if (value.scopes.includes('users') && actor.role !== 'administrator') throw new HttpError(403, 'ADMINISTRATOR_REQUIRED', 'La gestion des utilisateurs est réservée aux administrateurs.');
  const token = 'calas_' + randomBytes(32).toString('base64url');
  const createdAt = new Date();
  return getDb().transaction(async tx => {
    // Serialise issuance per account, so concurrent clicks cannot exceed the limit.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`calas-agent:${actor.id}`}, 0))`);
    const [current] = await tx.select({ user, session }).from(session).innerJoin(user, eq(user.id, session.userId))
      .where(and(eq(session.id, sessionId), eq(user.id, actor.id), gt(session.expiresAt, createdAt))).for('share');
    if (!current || current.user.disabled || !current.user.emailVerified || !hasRequiredAuthentication(current)
      || !['administrator', 'editor'].includes(current.user.role)) throw rejected();
    if (value.scopes.includes('users') && current.user.role !== 'administrator') throw new HttpError(403, 'ADMINISTRATOR_REQUIRED', 'La gestion des utilisateurs est réservée aux administrateurs.');
    const active = await tx.select({ id: agentTokens.id }).from(agentTokens)
      .where(and(eq(agentTokens.userId, actor.id), isNull(agentTokens.revokedAt), gt(agentTokens.expiresAt, createdAt)));
    if (active.length >= 10) throw new HttpError(409, 'TOKEN_LIMIT', 'Révoquez un ancien accès avant d’en créer un nouveau.');
    const expiresAt = new Date(Math.min(current.session.expiresAt.getTime(), createdAt.getTime() + 8 * 60 * 60_000));
    const [item] = await tx.insert(agentTokens).values({ name: value.name, tokenHash: hashToken(token),
      userId: actor.id, sessionId, scopes: value.scopes, createdAt, expiresAt }).returning(publicToken);
    await tx.insert(securityEvents).values({ id: randomUUID(), actorId: actor.id, action: 'agent.access.created' });
    return { token, item };
  });
}

export async function revokeAgentToken(actor: Actor, id: string) {
  await getDb().transaction(async tx => {
    const [item] = await tx.update(agentTokens).set({ revokedAt: new Date() })
      .where(and(eq(agentTokens.id, id), eq(agentTokens.userId, actor.id))).returning({ id: agentTokens.id });
    if (!item) throw new HttpError(404, 'NOT_FOUND', 'Cet accès est introuvable.');
    await tx.insert(securityEvents).values({ id: randomUUID(), actorId: actor.id, action: 'agent.access.revoked' });
  });
  return { revoked: true };
}

export async function requireAgentAccess(request: Request): Promise<AgentAccess> {
  // This is a bearer API for the local MCP bridge. It never accepts a browser session as fallback.
  if (request.headers.has('origin') || request.headers.has('cookie')) throw new HttpError(403, 'AGENT_TRANSPORT', 'Utilisez le connecteur MCP avec son accès personnel.');
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer calas_[A-Za-z0-9_-]{43}$/.test(authorization)) throw rejected();
  const now = new Date();
  const [current] = await getDb().select({ token: agentTokens, user, session }).from(agentTokens)
    .innerJoin(session, eq(session.id, agentTokens.sessionId)).innerJoin(user, eq(user.id, agentTokens.userId))
    .where(and(eq(agentTokens.tokenHash, hashToken(authorization.slice(7))), isNull(agentTokens.revokedAt),
      gt(agentTokens.expiresAt, now), gt(session.expiresAt, now), eq(session.userId, agentTokens.userId)));
  if (!current || current.user.disabled || !current.user.emailVerified || !hasRequiredAuthentication(current)
    || !['administrator', 'editor'].includes(current.user.role)
    || !current.token.scopes.includes('read') || current.token.scopes.some(scope => !agentScopes.includes(scope as AgentScope))) throw rejected();
  const { id, name, email, role } = current.user;
  return { actor: { id, name, email, role: role as Actor['role'] }, tokenId: current.token.id, scopes: current.token.scopes as AgentScope[] };
}

export function assertAgentScope(access: AgentAccess, scope: AgentScope) {
  if (!access.scopes.includes(scope) || scope === 'users' && access.actor.role !== 'administrator') throw new HttpError(403, 'AGENT_SCOPE', 'Cet accès n’autorise pas cette action.');
}

export async function recordAgentCall(access: AgentAccess, tool: string) {
  await getDb().transaction(async tx => {
    if (access.transport === 'oauth') await tx.update(oauthGrants).set({ lastUsedAt: new Date() }).where(eq(oauthGrants.id, access.tokenId));
    else await tx.update(agentTokens).set({ lastUsedAt: new Date() }).where(eq(agentTokens.id, access.tokenId));
    await tx.insert(securityEvents).values({ id: randomUUID(), actorId: access.actor.id, action: `agent.tool.requested.${tool}` });
  });
}
