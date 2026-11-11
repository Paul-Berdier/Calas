import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { session, user } from './auth-schema';

/** Delegated access lasts only while the issuing Better Auth session remains valid. */
export const agentTokens = pgTable('agent_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => session.id, { onDelete: 'cascade' }),
  scopes: text('scopes').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, table => [
  index('agent_tokens_user_idx').on(table.userId),
  check('agent_tokens_scopes', sql`${table.scopes} <@ ARRAY['read', 'draft', 'publish', 'outreach', 'send', 'users']::text[] AND 'read' = ANY(${table.scopes})`),
  check('agent_tokens_lifetime', sql`${table.expiresAt} > ${table.createdAt} AND ${table.expiresAt} <= ${table.createdAt} + INTERVAL '8 hours'`),
]);
