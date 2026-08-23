import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { eventsTable } from "./events";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventFeedbackLinksTable = pgTable("event_feedback_links", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  submittedAt: timestamp("submitted_at"),
});

export const eventFeedbackTable = pgTable("event_feedback", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  linkId: integer("link_id").references(() => eventFeedbackLinksTable.id, { onDelete: "set null" }),
  overallRating: integer("overall_rating").notNull(),
  comment: text("comment"),
  teamRatings: text("team_ratings"), // JSON string or jsonb
  usherOverrides: text("usher_overrides"), // JSON string or jsonb
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const insertEventFeedbackLinkSchema = createInsertSchema(eventFeedbackLinksTable).omit({ id: true });
export type InsertEventFeedbackLink = z.infer<typeof insertEventFeedbackLinkSchema>;
export type EventFeedbackLink = typeof eventFeedbackLinksTable.$inferSelect;

export const insertEventFeedbackSchema = createInsertSchema(eventFeedbackTable).omit({ id: true });
export type InsertEventFeedback = z.infer<typeof insertEventFeedbackSchema>;
export type EventFeedback = typeof eventFeedbackTable.$inferSelect;
