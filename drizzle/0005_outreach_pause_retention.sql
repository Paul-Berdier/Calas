CREATE TABLE "outreach_unsubscribe_links" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "outreach_unsubscribe_links" ("token_hash", "email_hash") SELECT "unsubscribe_hash", "email_hash" FROM "outreach_deliveries" ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "outreach_campaigns" DROP CONSTRAINT "outreach_campaigns_status";--> statement-breakpoint
CREATE INDEX "outreach_unsubscribe_links_email_hash" ON "outreach_unsubscribe_links" USING btree ("email_hash");--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_status" CHECK ("outreach_campaigns"."status" IN ('draft','active','paused'));
