CREATE TABLE "pending_tracks" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"fqn" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_tracks" ADD CONSTRAINT "pending_tracks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;