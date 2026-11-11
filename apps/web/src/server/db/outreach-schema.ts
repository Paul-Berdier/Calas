import {sql} from 'drizzle-orm';
import {boolean,check,date,index,integer,pgTable,text,timestamp,unique,uuid} from 'drizzle-orm/pg-core';
import {user} from './auth-schema';

const time=(name:string)=>timestamp(name,{withTimezone:true,mode:'date'}).notNull().defaultNow();

export const outreachProspects=pgTable('outreach_prospects',{
 id:uuid('id').primaryKey().defaultRandom(),version:integer('version').notNull().default(0),
 email:text('email').notNull().unique(),emailHash:text('email_hash').notNull().unique(),name:text('name').notNull(),company:text('company').notNull(),jobTitle:text('job_title').notNull(),
 source:text('source').notNull(),sourceDate:date('source_date').notNull(),informationConfirmed:boolean('information_confirmed').notNull(),
 status:text('status').notNull().default('active'),lastResponseAt:timestamp('last_response_at',{withTimezone:true}),retentionUntil:timestamp('retention_until',{withTimezone:true}).notNull(),
 createdBy:text('created_by').references(()=>user.id,{onDelete:'set null'}),createdAt:time('created_at'),updatedAt:time('updated_at'),
},t=>[check('outreach_prospects_status',sql`${t.status} IN ('active','responded','suppressed')`),check('outreach_prospects_version',sql`${t.version} >= 0`),check('outreach_prospects_information',sql`${t.informationConfirmed}`),index('outreach_prospects_retention').on(t.retentionUntil)]);

/** Minimal global opposition survives erasure or re-import of the contact. */
export const outreachSuppressions=pgTable('outreach_suppressions',{
 emailHash:text('email_hash').primaryKey(),reason:text('reason').notNull(),createdAt:time('created_at'),
});
/** Non-expiring opposition capability; no address, name or campaign membership survives erasure. */
export const outreachUnsubscribeLinks=pgTable('outreach_unsubscribe_links',{
 tokenHash:text('token_hash').primaryKey(),emailHash:text('email_hash').notNull(),createdAt:time('created_at'),
},t=>[index('outreach_unsubscribe_links_email_hash').on(t.emailHash)]);

export const outreachCampaigns=pgTable('outreach_campaigns',{
 id:uuid('id').primaryKey().defaultRandom(),version:integer('version').notNull().default(0),title:text('title').notNull(),subject:text('subject').notNull(),body:text('body').notNull(),targetPath:text('target_path').notNull(),status:text('status').notNull().default('draft'),
 linkHash:text('link_hash').notNull().unique(),linkEncrypted:text('link_encrypted').notNull(),
 createdBy:text('created_by').references(()=>user.id,{onDelete:'set null'}),createdAt:time('created_at'),updatedAt:time('updated_at'),
},t=>[check('outreach_campaigns_status',sql`${t.status} IN ('draft','active','paused')`),check('outreach_campaigns_version',sql`${t.version} >= 0`)]);

/** Each campaign/contact pair has one durable, immutable sending snapshot. */
export const outreachDeliveries=pgTable('outreach_deliveries',{
 id:uuid('id').primaryKey().defaultRandom(),campaignId:uuid('campaign_id').notNull().references(()=>outreachCampaigns.id,{onDelete:'cascade'}),contactId:uuid('contact_id').notNull().references(()=>outreachProspects.id,{onDelete:'cascade'}),
 email:text('email').notNull(),emailHash:text('email_hash').notNull(),subject:text('subject').notNull(),body:text('body').notNull(),transport:text('transport').notNull(),
 status:text('status').notNull().default('queued'),attempts:integer('attempts').notNull().default(0),nextAttemptAt:time('next_attempt_at'),startedAt:timestamp('started_at',{withTimezone:true}),finishedAt:timestamp('finished_at',{withTimezone:true}),
 unsubscribeHash:text('unsubscribe_hash').notNull().unique(),unsubscribeEncrypted:text('unsubscribe_encrypted').notNull(),createdAt:time('created_at'),
},t=>[unique('outreach_deliveries_campaign_contact').on(t.campaignId,t.contactId),index('outreach_deliveries_queue').on(t.status,t.nextAttemptAt),index('outreach_deliveries_email_hash').on(t.emailHash),check('outreach_deliveries_status',sql`${t.status} IN ('queued','sending','accepted','simulated','failed','uncertain','suppressed')`),check('outreach_deliveries_transport',sql`${t.transport} IN ('simulation','local','smtp')`),check('outreach_deliveries_attempts',sql`${t.attempts} >= 0`)]);

/** Campaign totals only: never a recipient, IP, browser fingerprint or visitor identifier. */
export const outreachCampaignVisits=pgTable('outreach_campaign_visits',{
 campaignId:uuid('campaign_id').notNull().references(()=>outreachCampaigns.id,{onDelete:'cascade'}),path:text('path').notNull(),day:date('day').notNull(),visits:integer('visits').notNull().default(0),arrivals:integer('arrivals').notNull().default(0),
},t=>[unique('outreach_campaign_visits_bucket').on(t.campaignId,t.path,t.day),check('outreach_campaign_visits_nonnegative',sql`${t.visits} >= 0 AND ${t.arrivals} >= 0 AND ${t.arrivals} <= ${t.visits}`)]);
