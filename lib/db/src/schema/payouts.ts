import { pgTable, serial, integer, real, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ushersTable } from "./ushers";

export const payoutsTable = pgTable("payouts", {
  id: serial("id").primaryKey(),
  usherId: integer("usher_id").notNull().references(() => ushersTable.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  method: varchar("method", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const insertPayoutSchema = createInsertSchema(payoutsTable).omit({ id: true });
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type Payout = typeof payoutsTable.$inferSelect;
