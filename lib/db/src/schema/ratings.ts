import { pgTable, serial, integer, varchar, text, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { eventAssignmentsTable } from "./event-assignments";

export const ratingsTable = pgTable("ratings", {
  id: serial("id").primaryKey(),
  eventAssignmentId: integer("event_assignment_id").notNull().references(() => eventAssignmentsTable.id, { onDelete: "cascade" }),
  ratedByType: varchar("rated_by_type", { length: 50 }).notNull(),
  ratingValue: integer("rating_value").notNull(),
  comment: text("comment"),
}, (table) => [
  check("rating_value_range", sql`${table.ratingValue} >= 1 AND ${table.ratingValue} <= 5`),
]);

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({ id: true });
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;
