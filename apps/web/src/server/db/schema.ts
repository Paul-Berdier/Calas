import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { media } from '../media/schema';
import { user } from './auth-schema';

export const contentKind = pgEnum('content_kind', ['home', 'page', 'article', 'person', 'statistic', 'category', 'settings']);
export const publicationStatus = pgEnum('publication_status', ['draft', 'published', 'archived']);
export const revisionAction = pgEnum('revision_action', ['created', 'saved', 'published', 'restored', 'discarded', 'imported']);
const time = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' }).notNull().defaultNow();

/** Shared publication envelope. Domain identity lives in the six one-to-one tables below. */
export const documents = pgTable('content_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: contentKind('kind').notNull(),
  internalTitle: text('internal_title').notNull(),
  status: publicationStatus('status').notNull().default('draft'),
  draftRevisionId: uuid('draft_revision_id').references((): AnyPgColumn => revisions.id, { onDelete: 'restrict' }),
  publishedRevisionId: uuid('published_revision_id').references((): AnyPgColumn => revisions.id, { onDelete: 'restrict' }),
  version: integer('version').notNull().default(0),
  protected: boolean('protected').notNull().default(false),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'restrict' }),
  createdAt: time('created_at'),
  updatedAt: time('updated_at'),
}, table => [
  index('content_documents_kind_status_idx').on(table.kind, table.status),
  check('content_documents_version_positive', sql`${table.version} >= 0`),
  check('content_documents_published_pointer', sql`${table.status} <> 'published' OR ${table.publishedRevisionId} IS NOT NULL`),
]);

/** Append-only snapshots, used by every editorial resource including people and settings. */
export const revisions = pgTable('content_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'restrict' }),
  version: integer('version').notNull(),
  content: jsonb('content').$type<Record<string, unknown>>().notNull(),
  action: revisionAction('action').notNull(),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'restrict' }),
  createdByName: text('created_by_name').notNull(),
  createdAt: time('created_at'),
}, table => [
  unique('content_revisions_document_version_unique').on(table.documentId, table.version),
  unique('content_revisions_document_id_unique').on(table.documentId, table.id),
  check('content_revisions_version_positive', sql`${table.version} > 0`),
]);

export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().references(() => documents.id, { onDelete: 'restrict' }),
  slug: text('slug').notNull().unique(),
  pageType: text('page_type').notNull(),
}, table => [check('pages_page_type_valid', sql`${table.pageType} IN ('home', 'page')`)]);

export const people = pgTable('people', {
  id: uuid('id').primaryKey().references(() => documents.id, { onDelete: 'restrict' }),
  displayOrder: integer('display_order').notNull().default(0),
}, table => [check('people_order_nonnegative', sql`${table.displayOrder} >= 0`)]);

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().references(() => documents.id, { onDelete: 'restrict' }),
  slug: text('slug').notNull().unique(),
});

export const statistics = pgTable('statistics', {
  id: uuid('id').primaryKey().references(() => documents.id, { onDelete: 'restrict' }),
  displayOrder: integer('display_order').notNull().default(0),
});

export const siteSettings = pgTable('site_settings', {
  id: uuid('id').primaryKey().references(() => documents.id, { onDelete: 'restrict' }),
  singleton: text('singleton').notNull().default('site').unique(),
}, table => [check('site_settings_singleton', sql`${table.singleton} = 'site'`)]);

export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().references(() => documents.id, { onDelete: 'restrict' }),
  slug: text('slug').notNull().unique(),
  creationKey: uuid('creation_key').unique(),
  creationHash: text('creation_hash'),
});

export const pageRevisions = pgTable('page_revisions', {
  id: uuid('id').primaryKey().references(() => revisions.id, { onDelete: 'restrict' }),
  pageId: uuid('page_id').notNull().references(() => pages.id, { onDelete: 'restrict' }),
  seo: jsonb('seo').$type<{ title?: string; description?: string }>().notNull().default({}),
});

export const articleRevisions = pgTable('article_revisions', {
  id: uuid('id').primaryKey().references(() => revisions.id, { onDelete: 'restrict' }),
  articleId: uuid('article_id').notNull().references(() => articles.id, { onDelete: 'restrict' }),
  authorId: uuid('author_id').references(() => people.id, { onDelete: 'restrict' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'restrict' }),
  coverMediaId: uuid('cover_media_id').references(() => media.id, { onDelete: 'restrict' }),
  sourcePdfMediaId: uuid('source_pdf_media_id').references(() => media.id, { onDelete: 'restrict' }),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
}, table => [index('article_revisions_author_idx').on(table.authorId), index('article_revisions_category_idx').on(table.categoryId)]);

export const revisionReferences = pgTable('revision_references', {
  id: uuid('id').primaryKey().defaultRandom(),
  revisionId: uuid('revision_id').notNull().references(() => revisions.id, { onDelete: 'restrict' }),
  targetDocumentId: uuid('target_document_id').notNull().references(() => documents.id, { onDelete: 'restrict' }),
  relation: text('relation').notNull(),
}, table => [unique('revision_references_unique').on(table.revisionId, table.targetDocumentId, table.relation)]);

export const mediaReferences = pgTable('media_references', {
  id: uuid('id').primaryKey().defaultRandom(),
  mediaId: uuid('media_id').notNull().references(() => media.id, { onDelete: 'restrict' }),
  resourceKind: contentKind('resource_kind').notNull(),
  resourceId: uuid('resource_id').notNull().references(() => documents.id, { onDelete: 'restrict' }),
  revisionId: uuid('revision_id').notNull().references(() => revisions.id, { onDelete: 'restrict' }),
  isPublished: boolean('is_published').notNull().default(false),
  downloadAllowed: boolean('download_allowed').notNull().default(false),
}, table => [
  unique('media_references_media_revision_unique').on(table.mediaId, table.revisionId),
  index('media_references_public_idx').on(table.mediaId, table.isPublished),
  foreignKey({ name: 'media_references_revision_owner_fk', columns: [table.resourceId, table.revisionId], foreignColumns: [revisions.documentId, revisions.id] }),
]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: text('action').notNull(),
  actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
  actorName: text('actor_name').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  title: text('title').notNull(),
  metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null>>().notNull().default({}),
  createdAt: time('created_at'),
}, table => [index('audit_logs_created_at_idx').on(table.createdAt), index('audit_logs_resource_idx').on(table.resourceType, table.resourceId)]);
