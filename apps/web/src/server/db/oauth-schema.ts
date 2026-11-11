import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { session, user } from './auth-schema';

const time = (name: string) => timestamp(name, { withTimezone: true });
export const oauthClients = pgTable('oauth_clients', {
  id: text('id').primaryKey(), name: text('name').notNull(), redirectUris: text('redirect_uris').array().notNull(),
  authMethod: text('auth_method').notNull(), secretHash: text('secret_hash'), createdAt: time('created_at').defaultNow().notNull(),
}, table => [check('oauth_clients_method', sql`${table.authMethod} IN ('none','client_secret_post','client_secret_basic')`)]);
export const oauthRequests = pgTable('oauth_requests', {
  id: text('id').primaryKey(), clientId: text('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(), state: text('state').notNull(), challenge: text('challenge').notNull(), resource: text('resource').notNull(),
  scopes: text('scopes').array().notNull(), sessionId: text('session_id').references(() => session.id, { onDelete: 'cascade' }),
  createdAt: time('created_at').defaultNow().notNull(), expiresAt: time('expires_at').notNull(), usedAt: time('used_at'),
}, table => [index('oauth_requests_expiry').on(table.expiresAt)]);
export const oauthGrants = pgTable('oauth_grants', {
  id: uuid('id').primaryKey().defaultRandom(), clientId: text('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }), sessionId: text('session_id').notNull().references(() => session.id, { onDelete: 'cascade' }),
  resource: text('resource').notNull(), scopes: text('scopes').array().notNull(), createdAt: time('created_at').defaultNow().notNull(),
  expiresAt: time('expires_at').notNull(), revokedAt: time('revoked_at'), lastUsedAt: time('last_used_at'),
}, table => [index('oauth_grants_user').on(table.userId), check('oauth_grants_scope', sql`${table.scopes} <@ ARRAY['read','draft','publish','outreach','send','users']::text[] AND 'read'=ANY(${table.scopes})`),
  check('oauth_grants_expiry', sql`${table.expiresAt}>${table.createdAt} AND ${table.expiresAt}<=${table.createdAt}+INTERVAL '8 hours'`)]);
export const oauthCodes = pgTable('oauth_codes', {
  hash: text('hash').primaryKey(), grantId: uuid('grant_id').notNull().references(() => oauthGrants.id, { onDelete: 'cascade' }),
  challenge: text('challenge').notNull(), redirectUri: text('redirect_uri').notNull(), expiresAt: time('expires_at').notNull(), usedAt: time('used_at'),
});
export const oauthTokens = pgTable('oauth_tokens', {
  hash: text('hash').primaryKey(), grantId: uuid('grant_id').notNull().references(() => oauthGrants.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), createdAt: time('created_at').defaultNow().notNull(), expiresAt: time('expires_at').notNull(), usedAt: time('used_at'),
}, table => [index('oauth_tokens_grant').on(table.grantId), check('oauth_tokens_kind', sql`${table.kind} IN ('access','refresh')`)]);
