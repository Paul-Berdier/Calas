CREATE TABLE "contact_receipts" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"payload_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "contact_receipts_expiry_idx" ON "contact_receipts" USING btree ("expires_at");