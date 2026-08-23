import { pgTable, serial, varchar, text, real, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { adminsTable } from "./admins";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  eventLocName: varchar("event_loc_name", { length: 255 }),
  eventLocUrl: text("event_loc_url"),
  venueLat: real("venue_lat"),
  venueLng: real("venue_lng"),
  meetingPointLat: real("meeting_point_lat"),
  meetingPointLng: real("meeting_point_lng"),
  dressCode: text("dress_code"),
  instructions: text("instructions"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  checkinRadiusM: integer("checkin_radius_m").default(100),
  checkinWindowMinutes: integer("checkin_window_minutes").default(5),
  budget: real("event_budget").default(0.0),
  leaderRate: real("leader_rate").default(0.0),
  regularRate: real("regular_rate").default(0.0),
  superAdminLockedFields: jsonb("super_admin_locked_fields").$type<string[]>().default([]),
  contactName: varchar("contact_name", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  status: varchar("status", { length: 50 }).default("draft"),
  version: integer("version").notNull().default(1),
  createdByAdminId: integer("created_by_admin_id").references(() => adminsTable.id, { onDelete: "set null" }),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
