CREATE TABLE "system_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by_admin_id" integer
);
--> statement-breakpoint
CREATE TABLE "reliability_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"usher_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ushers" ADD COLUMN "client_rating_avg" real;--> statement-breakpoint
ALTER TABLE "ushers" ADD COLUMN "punctuality_score" real;--> statement-breakpoint
ALTER TABLE "ushers" ADD COLUMN "reliability_score" real;--> statement-breakpoint
ALTER TABLE "ushers" ADD COLUMN "last_rating_recalc_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_admin_id_admins_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reliability_events" ADD CONSTRAINT "reliability_events_usher_id_ushers_id_fk" FOREIGN KEY ("usher_id") REFERENCES "public"."ushers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reliability_events" ADD CONSTRAINT "reliability_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;