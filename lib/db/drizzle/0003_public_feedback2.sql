ALTER TABLE "event_feedback" ADD COLUMN "link_id" integer;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD COLUMN "team_ratings" text;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD COLUMN "usher_overrides" text;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_link_id_event_feedback_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."event_feedback_links"("id") ON DELETE set null ON UPDATE no action;