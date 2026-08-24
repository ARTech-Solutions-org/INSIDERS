import { pgTable, serial, integer, varchar, boolean, real, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { ushersTable } from "./ushers";
import { eventTeamsTable } from "./event-teams";

export const eventAssignmentsTable = pgTable("event_assignments", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  eventTeamId: integer("event_team_id").references(() => eventTeamsTable.id, { onDelete: "set null" }),
  usherId: integer("usher_id").notNull().references(() => ushersTable.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).default("regular"),
  overriddenPay: real("overridden_pay"),
  status: varchar("status", { length: 50 }).default("assigned"),
  isTeamLead: boolean("is_team_lead").default(false),
  checkinTime: timestamp("checkin_time", { withTimezone: true }),
  checkinLat: real("checkin_lat"),
  checkinLng: real("checkin_lng"),
  checkinMethod: varchar("checkin_method", { length: 50 }),
  lateArrivalMinutes: integer("late_arrival_minutes").default(0),   // minutes after event start
  checkoutTime: timestamp("checkout_time", { withTimezone: true }),
  checkoutLat: real("checkout_lat"),
  checkoutLng: real("checkout_lng"),
  earlyLeaveMinutes: integer("early_leave_minutes").default(0),     // minutes before event end
  reminderSent: boolean("reminder_sent").default(false),
}, (table) => ({
  usherEventUnique: unique("usher_event_unique").on(table.usherId, table.eventId),
}));

export const insertEventAssignmentSchema = createInsertSchema(eventAssignmentsTable).omit({ id: true });
export type InsertEventAssignment = z.infer<typeof insertEventAssignmentSchema>;
export type EventAssignment = typeof eventAssignmentsTable.$inferSelect;
