import { pgTable, serial, integer, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventAssignmentsTable } from "./event-assignments";

export const cancellationsTable = pgTable("cancellations", {
  id: serial("id").primaryKey(),
  eventAssignmentId: integer("event_assignment_id").unique().notNull().references(() => eventAssignmentsTable.id, { onDelete: "cascade" }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }).notNull().defaultNow(),
  reason: text("reason"),
  penaltyApplied: boolean("penalty_applied").default(false),
});

export const insertCancellationSchema = createInsertSchema(cancellationsTable).omit({ id: true, cancelledAt: true });
export type InsertCancellation = z.infer<typeof insertCancellationSchema>;
export type Cancellation = typeof cancellationsTable.$inferSelect;
