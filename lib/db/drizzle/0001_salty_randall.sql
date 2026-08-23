ALTER TABLE "event_assignments" ADD COLUMN "role" varchar(50) DEFAULT 'regular';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "leader_rate" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "regular_rate" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "super_admin_locked_fields" jsonb DEFAULT '[]'::jsonb;