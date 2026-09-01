import { pgTable, serial, integer, varchar, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventAssignmentsTable } from "./event-assignments";
import { adminsTable } from "./admins";

export const assignmentDeductionsTable = pgTable("assignment_deductions", {
  id: serial("id").primaryKey(),
  eventAssignmentId: integer("event_assignment_id").notNull().references(() => eventAssignmentsTable.id, { onDelete: "cascade" }),
  adminId: integer("admin_id").notNull().references(() => adminsTable.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 255 }).notNull(),
  amount: real("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertAssignmentDeductionSchema = createInsertSchema(assignmentDeductionsTable).omit({ id: true, createdAt: true });
export type InsertAssignmentDeduction = z.infer<typeof insertAssignmentDeductionSchema>;
export type AssignmentDeduction = typeof assignmentDeductionsTable.$inferSelect;
