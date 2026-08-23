CREATE TABLE "event_feedback_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"token" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"submitted_at" timestamp,
	CONSTRAINT "event_feedback_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "event_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"overall_rating" integer NOT NULL,
	"comment" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_feedback_links" ADD CONSTRAINT "event_feedback_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;