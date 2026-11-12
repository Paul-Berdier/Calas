CREATE TABLE "outreach_message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"target_path" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_message_templates_version" CHECK ("outreach_message_templates"."version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "outreach_deliveries" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outreach_message_templates" ADD CONSTRAINT "outreach_message_templates_created_by_auth_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outreach_message_templates_created" ON "outreach_message_templates" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "outreach_deliveries_history" ON "outreach_deliveries" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "outreach_deliveries_campaign_history" ON "outreach_deliveries" USING btree ("campaign_id","created_at","id");