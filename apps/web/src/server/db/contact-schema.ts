import {index,jsonb,pgTable,text,timestamp} from 'drizzle-orm/pg-core';
import type {ContactResult} from '../../lib/contact';

/** No message, name, address or email is retained: keyed digests and delivery outcome only. */
export const contactReceipts=pgTable('contact_receipts',{
  tokenHash:text('token_hash').primaryKey(),
  payloadHash:text('payload_hash').notNull(),
  result:jsonb('result').$type<ContactResult>().notNull(),
  expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),
},table=>[index('contact_receipts_expiry_idx').on(table.expiresAt)]);
