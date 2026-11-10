// Better Auth 1.7.12 core and two-factor schema; plugins own password/session algorithms.
import {pgTable,text,boolean,timestamp,integer,bigint,index,uniqueIndex,check} from 'drizzle-orm/pg-core';
import {sql} from 'drizzle-orm';
const time=(name:string)=>timestamp(name,{withTimezone:true});
export const user=pgTable('auth_user',{
  id:text('id').primaryKey(),name:text('name').notNull(),email:text('email').notNull().unique(),emailVerified:boolean('email_verified').notNull().default(false),image:text('image'),
  createdAt:time('created_at').notNull().defaultNow(),updatedAt:time('updated_at').notNull().defaultNow(),
  role:text('role').notNull().default('editor'),disabled:boolean('disabled').notNull().default(false),twoFactorEnabled:boolean('two_factor_enabled').notNull().default(false),
},table=>[check('auth_role_check',sql`${table.role} in ('administrator','editor')`)]);
export const session=pgTable('auth_session',{
  id:text('id').primaryKey(),expiresAt:time('expires_at').notNull(),token:text('token').notNull().unique(),createdAt:time('created_at').notNull().defaultNow(),updatedAt:time('updated_at').notNull().defaultNow(),
  ipAddress:text('ip_address'),userAgent:text('user_agent'),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),mfaVerified:boolean('mfa_verified').notNull().default(false),
},table=>[index('auth_session_user_idx').on(table.userId)]);
export const account=pgTable('auth_account',{
  id:text('id').primaryKey(),accountId:text('account_id').notNull(),providerId:text('provider_id').notNull(),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
  accessToken:text('access_token'),refreshToken:text('refresh_token'),idToken:text('id_token'),accessTokenExpiresAt:time('access_token_expires_at'),refreshTokenExpiresAt:time('refresh_token_expires_at'),scope:text('scope'),password:text('password'),
  createdAt:time('created_at').notNull().defaultNow(),updatedAt:time('updated_at').notNull().defaultNow(),
},table=>[index('auth_account_user_idx').on(table.userId),uniqueIndex('auth_account_provider_idx').on(table.providerId,table.accountId)]);
export const verification=pgTable('auth_verification',{
  id:text('id').primaryKey(),identifier:text('identifier').notNull(),value:text('value').notNull(),expiresAt:time('expires_at').notNull(),createdAt:time('created_at').notNull().defaultNow(),updatedAt:time('updated_at').notNull().defaultNow(),
},table=>[index('auth_verification_identifier_idx').on(table.identifier)]);
export const twoFactor=pgTable('auth_two_factor',{
  id:text('id').primaryKey(),secret:text('secret').notNull(),backupCodes:text('backup_codes').notNull(),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),verified:boolean('verified').default(true),failedVerificationCount:integer('failed_verification_count').default(0),lockedUntil:time('locked_until'),
},table=>[index('auth_two_factor_user_idx').on(table.userId),index('auth_two_factor_secret_idx').on(table.secret)]);
export const rateLimit=pgTable('auth_rate_limit',{
  id:text('id').primaryKey(),key:text('key').notNull().unique(),count:integer('count').notNull(),lastRequest:bigint('last_request',{mode:'number'}).notNull(),
});
export const invitations=pgTable('auth_invitation',{
  id:text('id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),role:text('role').notNull(),tokenHash:text('token_hash').notNull().unique(),expiresAt:time('expires_at').notNull(),usedAt:time('used_at'),createdBy:text('created_by').notNull().references(()=>user.id),createdAt:time('created_at').notNull().defaultNow(),
},table=>[check('invitation_role_check',sql`${table.role} in ('administrator','editor')`)]);
export const securityEvents=pgTable('security_events',{
  id:text('id').primaryKey(),actorId:text('actor_id').references(()=>user.id),action:text('action').notNull(),createdAt:time('created_at').notNull().defaultNow(),
});
