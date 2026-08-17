import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { ushersTable } from "./ushers";

export const waitlistTable = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  usherId: integer("usher_id").notNull().references(() => ushersTable.id, { onDelete: "cascade" }),
  priorityOrder: integer("priority_order").notNull(),
  status: text("status", { enum: ["pending", "accepted", "rejected"] }).notNull().default("pending"),
});

export const insertWaitlistSchema = createInsertSchema(waitlistTable).omit({ id: true });
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;
export type Waitlist = typeof waitlistTable.$inferSelect;
