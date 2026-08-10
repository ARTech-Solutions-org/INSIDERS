import { pgTable, serial, integer, real, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ushersTable } from "./ushers";
import { eventAssignmentsTable } from "./event-assignments";

export const balanceTransactionsTable = pgTable("balance_transactions", {
  id: serial("id").primaryKey(),
  usherId: integer("usher_id").notNull().references(() => ushersTable.id, { onDelete: "cascade" }),
  eventAssignmentId: integer("event_assignment_id").references(() => eventAssignmentsTable.id, { onDelete: "set null" }),
  amount: real("amount").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBalanceTransactionSchema = createInsertSchema(balanceTransactionsTable).omit({ id: true, createdAt: true });
export type InsertBalanceTransaction = z.infer<typeof insertBalanceTransactionSchema>;
export type BalanceTransaction = typeof balanceTransactionsTable.$inferSelect;
