import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ushersTable } from "./ushers";
import { eventsTable } from "./events";

export const reliabilityEventsTable = pgTable("reliability_events", {
  id: serial("id").primaryKey(),
  usherId: integer("usher_id").notNull().references(() => ushersTable.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // "no_show" | "late_cancellation"
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertReliabilityEventSchema = createInsertSchema(reliabilityEventsTable).omit({ id: true, occurredAt: true });
export type InsertReliabilityEvent = z.infer<typeof insertReliabilityEventSchema>;
export type ReliabilityEvent = typeof reliabilityEventsTable.$inferSelect;
