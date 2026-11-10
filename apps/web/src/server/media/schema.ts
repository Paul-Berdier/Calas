import {sql} from 'drizzle-orm';
import {pgTable,uuid,text,integer,bigint,jsonb,timestamp,uniqueIndex,index,check} from 'drizzle-orm/pg-core';
import {user} from '../db/auth-schema';

export interface MediaVariant {key:string;width:number;height:number;size:number;mimeType:string}
export interface MediaMetadata {
  checksum:string;
  pageCount?:number;
  variants?:MediaVariant[];
  crop?:{top:number;bottom:number;left:number;right:number};
  hotspot?:{x:number;y:number;width:number;height:number};
  retiredKeys?:string[];
}

/** Storage keys and checksums are server-only. Publication grants live in
 * media_references and are changed in the same transaction as publication. */
export const media=pgTable('media',{
  id:uuid('id').primaryKey().defaultRandom(),
  storageKey:text('storage_key').notNull(),
  uploadKey:text('upload_key').notNull(),
  originalFilename:text('original_filename').notNull(),
  mimeType:text('mime_type').notNull(),
  sizeBytes:bigint('size_bytes',{mode:'number'}).notNull(),
  width:integer('width'),height:integer('height'),
  altText:text('alt_text').notNull().default(''),
  metadata:jsonb('metadata').$type<MediaMetadata>().notNull(),
  visibility:text('visibility').notNull().default('private'),
  createdBy:text('created_by').notNull().references(()=>user.id,{onDelete:'restrict'}),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},table=>[
  uniqueIndex('media_storage_key_unique').on(table.storageKey),
  uniqueIndex('media_upload_key_unique').on(table.uploadKey),
  index('media_created_at_idx').on(table.createdAt),
  check('media_size_positive',sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 20971520`),
  check('media_visibility_valid',sql`${table.visibility} IN ('private','published')`),
  check('media_mime_valid',sql`${table.mimeType} IN ('image/jpeg','image/png','application/pdf')`),
]);
export type MediaRow=typeof media.$inferSelect;

// An outbox makes deletions retryable across the PostgreSQL/S3 boundary. A
// failed storage request leaves only private objects, never broken references.
export const mediaDeletions=pgTable('media_deletions',{
  id:uuid('id').primaryKey().defaultRandom(),
  keys:jsonb('keys').$type<string[]>().notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
});
