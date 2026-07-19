CREATE TYPE "public"."alert_type" AS ENUM('expiry-30d', 'expiry-7d', 'expiry-1d', 'grace-started', 'grace-half', 'available', 'owner-changed');--> statement-breakpoint
CREATE TYPE "public"."name_status" AS ENUM('active', 'grace', 'available', 'nonexpiring', 'unregistered', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."track_mode" AS ENUM('own', 'want');--> statement-breakpoint
CREATE TYPE "public"."track_source" AS ENUM('manual', 'discovered');--> statement-breakpoint
CREATE TABLE "alerts_sent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fqn" text NOT NULL,
	"alert_type" "alert_type" NOT NULL,
	"suppressed" boolean DEFAULT false NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "name_state" (
	"fqn" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"namespace" text NOT NULL,
	"owner" text,
	"renewal_height" bigint,
	"lifetime" bigint NOT NULL,
	"status" "name_status" NOT NULL,
	"is_managed" boolean DEFAULT false NOT NULL,
	"current_burn_block" bigint NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stacks_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_names" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fqn" text NOT NULL,
	"mode" "track_mode" NOT NULL,
	"source" "track_source" DEFAULT 'manual' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"telegram_chat_id" text,
	"telegram_active" boolean DEFAULT true NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_telegram_chat_id_unique" UNIQUE("telegram_chat_id")
);
--> statement-breakpoint
ALTER TABLE "alerts_sent" ADD CONSTRAINT "alerts_sent_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_addresses" ADD CONSTRAINT "tracked_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_names" ADD CONSTRAINT "tracked_names_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_sent_user_fqn_type" ON "alerts_sent" USING btree ("user_id","fqn","alert_type");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_addresses_user_address" ON "tracked_addresses" USING btree ("user_id","stacks_address");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_names_user_fqn" ON "tracked_names" USING btree ("user_id","fqn");