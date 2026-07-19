ALTER TABLE "users" ADD COLUMN "email_verify_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verify_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "unsubscribe_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_unsubscribe_token_unique" UNIQUE("unsubscribe_token");