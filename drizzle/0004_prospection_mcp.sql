CREATE TABLE "outreach_campaign_visits" (
	"campaign_id" uuid NOT NULL,
	"path" text NOT NULL,
	"day" date NOT NULL,
	"visits" integer DEFAULT 0 NOT NULL,
	"arrivals" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "outreach_campaign_visits_bucket" UNIQUE("campaign_id","path","day"),
	CONSTRAINT "outreach_campaign_visits_nonnegative" CHECK ("outreach_campaign_visits"."visits" >= 0 AND "outreach_campaign_visits"."arrivals" >= 0 AND "outreach_campaign_visits"."arrivals" <= "outreach_campaign_visits"."visits")
);
--> statement-breakpoint
CREATE TABLE "outreach_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"target_path" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"link_hash" text NOT NULL,
	"link_encrypted" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_campaigns_link_hash_unique" UNIQUE("link_hash"),
	CONSTRAINT "outreach_campaigns_status" CHECK ("outreach_campaigns"."status" IN ('draft','active')),
	CONSTRAINT "outreach_campaigns_version" CHECK ("outreach_campaigns"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "outreach_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"email" text NOT NULL,
	"email_hash" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"transport" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"unsubscribe_hash" text NOT NULL,
	"unsubscribe_encrypted" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_deliveries_unsubscribe_hash_unique" UNIQUE("unsubscribe_hash"),
	CONSTRAINT "outreach_deliveries_campaign_contact" UNIQUE("campaign_id","contact_id"),
	CONSTRAINT "outreach_deliveries_status" CHECK ("outreach_deliveries"."status" IN ('queued','sending','accepted','simulated','failed','uncertain','suppressed')),
	CONSTRAINT "outreach_deliveries_transport" CHECK ("outreach_deliveries"."transport" IN ('simulation','local','smtp')),
	CONSTRAINT "outreach_deliveries_attempts" CHECK ("outreach_deliveries"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "outreach_prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"email" text NOT NULL,
	"email_hash" text NOT NULL,
	"name" text NOT NULL,
	"company" text NOT NULL,
	"job_title" text NOT NULL,
	"source" text NOT NULL,
	"source_date" date NOT NULL,
	"information_confirmed" boolean NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_response_at" timestamp with time zone,
	"retention_until" timestamp with time zone NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_prospects_email_unique" UNIQUE("email"),
	CONSTRAINT "outreach_prospects_email_hash_unique" UNIQUE("email_hash"),
	CONSTRAINT "outreach_prospects_status" CHECK ("outreach_prospects"."status" IN ('active','responded','suppressed')),
	CONSTRAINT "outreach_prospects_version" CHECK ("outreach_prospects"."version" >= 0),
	CONSTRAINT "outreach_prospects_information" CHECK ("outreach_prospects"."information_confirmed")
);
--> statement-breakpoint
CREATE TABLE "outreach_suppressions" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "agent_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "agent_tokens_scopes" CHECK ("agent_tokens"."scopes" <@ ARRAY['read', 'draft', 'publish', 'outreach', 'send', 'users']::text[] AND 'read' = ANY("agent_tokens"."scopes")),
	CONSTRAINT "agent_tokens_lifetime" CHECK ("agent_tokens"."expires_at" > "agent_tokens"."created_at" AND "agent_tokens"."expires_at" <= "agent_tokens"."created_at" + INTERVAL '8 hours')
);
--> statement-breakpoint
ALTER TABLE "outreach_campaign_visits" ADD CONSTRAINT "outreach_campaign_visits_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_created_by_auth_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_deliveries" ADD CONSTRAINT "outreach_deliveries_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_deliveries" ADD CONSTRAINT "outreach_deliveries_contact_id_outreach_prospects_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."outreach_prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_prospects" ADD CONSTRAINT "outreach_prospects_created_by_auth_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tokens" ADD CONSTRAINT "agent_tokens_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tokens" ADD CONSTRAINT "agent_tokens_session_id_auth_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auth_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outreach_deliveries_queue" ON "outreach_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "outreach_deliveries_email_hash" ON "outreach_deliveries" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "outreach_prospects_retention" ON "outreach_prospects" USING btree ("retention_until");--> statement-breakpoint
CREATE INDEX "agent_tokens_user_idx" ON "agent_tokens" USING btree ("user_id");