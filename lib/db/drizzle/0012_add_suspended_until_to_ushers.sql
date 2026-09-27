CREATE TABLE "assignment_deductions" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_assignment_id" integer NOT NULL,
	"admin_id" integer NOT NULL,
	"reason" varchar(255) NOT NULL,
	"amount" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"category" varchar(100),
	"keywords" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"admin_id" integer NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deduction_rules" ADD COLUMN "trigger_type" varchar(50) DEFAULT 'always' NOT NULL;--> statement-breakpoint
ALTER TABLE "deduction_rules" ADD COLUMN "threshold_minutes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "event_assignments" ADD COLUMN "checkin_photo_key" varchar(255);--> statement-breakpoint
ALTER TABLE "ushers" ADD COLUMN "suspended_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assignment_deductions" ADD CONSTRAINT "assignment_deductions_event_assignment_id_event_assignments_id_fk" FOREIGN KEY ("event_assignment_id") REFERENCES "public"."event_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_deductions" ADD CONSTRAINT "assignment_deductions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chats" ADD CONSTRAINT "event_chats_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chats" ADD CONSTRAINT "event_chats_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;