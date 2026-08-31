DROP TABLE "waitlist" CASCADE;--> statement-breakpoint
ALTER TABLE "event_teams" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "ushers" ADD COLUMN "dress_size" varchar(20);