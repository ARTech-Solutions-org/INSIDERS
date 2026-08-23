CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"created_by_admin_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"action_type" varchar(100) NOT NULL,
	"target_table" varchar(100) NOT NULL,
	"target_id" integer,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balance_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"usher_id" integer NOT NULL,
	"event_assignment_id" integer,
	"amount" real NOT NULL,
	"type" varchar(50) NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sent_by_admin_id" integer,
	"message" text NOT NULL,
	"target_filter" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cancellations" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_assignment_id" integer NOT NULL,
	"cancelled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"penalty_applied" boolean DEFAULT false,
	CONSTRAINT "cancellations_event_assignment_id_unique" UNIQUE("event_assignment_id")
);
--> statement-breakpoint
CREATE TABLE "deduction_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"rule_type" varchar(100) NOT NULL,
	"amount" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"event_team_id" integer,
	"usher_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'assigned',
	"is_team_lead" boolean DEFAULT false,
	"checkin_time" timestamp with time zone,
	"checkin_lat" real,
	"checkin_lng" real,
	"checkin_method" varchar(50),
	"late_arrival_minutes" integer DEFAULT 0,
	"checkout_time" timestamp with time zone,
	"checkout_lat" real,
	"checkout_lng" real,
	"early_leave_minutes" integer DEFAULT 0,
	"reminder_sent" boolean DEFAULT false,
	CONSTRAINT "usher_event_unique" UNIQUE("usher_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "event_holder_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"unique_token" varchar(255) NOT NULL,
	CONSTRAINT "event_holder_links_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "event_holder_links_unique_token_unique" UNIQUE("unique_token")
);
--> statement-breakpoint
CREATE TABLE "event_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"event_loc_name" varchar(255),
	"event_loc_url" text,
	"venue_lat" real,
	"venue_lng" real,
	"meeting_point_lat" real,
	"meeting_point_lng" real,
	"dress_code" text,
	"instructions" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"checkin_radius_m" integer DEFAULT 100,
	"checkin_window_minutes" integer DEFAULT 5,
	"event_budget" real DEFAULT 0,
	"contact_name" varchar(255),
	"contact_phone" varchar(50),
	"status" varchar(50) DEFAULT 'draft',
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_admin_id" integer
);
--> statement-breakpoint
CREATE TABLE "ushers" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"full_name_arabic" varchar(255),
	"phone" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"national_id_number" varchar(100) NOT NULL,
	"national_id_doc_url" text,
	"national_id_doc_key" text,
	"national_id_doc_back_url" text,
	"national_id_doc_back_key" text,
	"profile_photo_url" text,
	"profile_photo_key" text,
	"password_hash" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"gender" varchar(20),
	"date_of_birth" date,
	"height" integer,
	"university" varchar(255),
	"major" varchar(255),
	"languages" jsonb,
	"shoe_size" varchar(20),
	"shirt_size" varchar(20),
	"t_shirt_size" varchar(20),
	"pants_size" varchar(20),
	"shorts_size" varchar(20),
	"home_lat" real,
	"home_lng" real,
	"avg_rating" real DEFAULT 0,
	"balance" real DEFAULT 0,
	"payment_method" varchar(50),
	"payment_method_details" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ushers_phone_unique" UNIQUE("phone"),
	CONSTRAINT "ushers_email_unique" UNIQUE("email"),
	CONSTRAINT "ushers_national_id_number_unique" UNIQUE("national_id_number")
);
--> statement-breakpoint
CREATE TABLE "usher_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"usher_id" integer NOT NULL,
	"doc_type" varchar(100) NOT NULL,
	"file_url" text NOT NULL,
	"file_key" text NOT NULL,
	"expiry_date" date,
	"status" varchar(50) DEFAULT 'pending'
);
--> statement-breakpoint
CREATE TABLE "usher_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"usher_id" integer NOT NULL,
	"skill_type" varchar(100) NOT NULL,
	"value" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usher_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"usher_id" integer NOT NULL,
	"date" date NOT NULL,
	"start_time" text DEFAULT '00:00' NOT NULL,
	"end_time" text DEFAULT '23:59' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"usher_id" integer NOT NULL,
	"priority_order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"usher_id" integer NOT NULL,
	"amount" real NOT NULL,
	"method" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_assignment_id" integer NOT NULL,
	"rated_by_type" varchar(50) NOT NULL,
	"rating_value" integer NOT NULL,
	"comment" text,
	CONSTRAINT "rating_value_range" CHECK ("ratings"."rating_value" >= 1 AND "ratings"."rating_value" <= 5)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_type" varchar(50) NOT NULL,
	"recipient_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usher_push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"usher_id" integer NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_created_by_admin_id_admins_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_transactions" ADD CONSTRAINT "balance_transactions_usher_id_ushers_id_fk" FOREIGN KEY ("usher_id") REFERENCES "public"."ushers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_transactions" ADD CONSTRAINT "balance_transactions_event_assignment_id_event_assignments_id_fk" FOREIGN KEY ("event_assignment_id") REFERENCES "public"."event_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_sent_by_admin_id_admins_id_fk" FOREIGN KEY ("sent_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_event_assignment_id_event_assignments_id_fk" FOREIGN KEY ("event_assignment_id") REFERENCES "public"."event_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deduction_rules" ADD CONSTRAINT "deduction_rules_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_event_team_id_event_teams_id_fk" FOREIGN KEY ("event_team_id") REFERENCES "public"."event_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_usher_id_ushers_id_fk" FOREIGN KEY ("usher_id") REFERENCES "public"."ushers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_holder_links" ADD CONSTRAINT "event_holder_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_admin_id_admins_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usher_documents" ADD CONSTRAINT "usher_documents_usher_id_ushers_id_fk" FOREIGN KEY ("usher_id") REFERENCES "public"."ushers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usher_skills" ADD CONSTRAINT "usher_skills_usher_id_ushers_id_fk" FOREIGN KEY ("usher_id") REFERENCES "public"."ushers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usher_availability" ADD CONSTRAINT "usher_availability_usher_id_ushers_id_fk" FOREIGN KEY ("usher_id") REFERENCES "public"."ushers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_usher_id_ushers_id_fk" FOREIGN KEY ("usher_id") REFERENCES "public"."ushers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_usher_id_ushers_id_fk" FOREIGN KEY ("usher_id") REFERENCES "public"."ushers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_event_assignment_id_event_assignments_id_fk" FOREIGN KEY ("event_assignment_id") REFERENCES "public"."event_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usher_push_tokens" ADD CONSTRAINT "usher_push_tokens_usher_id_ushers_id_fk" FOREIGN KEY ("usher_id") REFERENCES "public"."ushers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usher_push_tokens_usher_token_idx" ON "usher_push_tokens" USING btree ("usher_id","token");