import { pgTable, serial, integer, varchar, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";

export const deductionRulesTable = pgTable("deduction_rules", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  ruleType: varchar("rule_type", { length: 100 }).notNull(),
  amount: real("amount").notNull(),
  triggerType: varchar("trigger_type", { length: 50 }).notNull().default("always"), // always, late_arrival, early_leave, late_cancellation
  thresholdMinutes: integer("threshold_minutes").default(0),
});

export const insertDeductionRuleSchema = createInsertSchema(deductionRulesTable).omit({ id: true });
export type InsertDeductionRule = z.infer<typeof insertDeductionRuleSchema>;
export type DeductionRule = typeof deductionRulesTable.$inferSelect;
