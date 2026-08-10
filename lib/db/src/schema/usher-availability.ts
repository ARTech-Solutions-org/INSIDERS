import { pgTable, serial, integer, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ushersTable } from "./ushers";

export const usherAvailabilityTable = pgTable("usher_availability", {
  id: serial("id").primaryKey(),
  usherId: integer("usher_id").notNull().references(() => ushersTable.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  isAvailable: boolean("is_available").default(true),
});

export const insertUsherAvailabilitySchema = createInsertSchema(usherAvailabilityTable).omit({ id: true });
export type InsertUsherAvailability = z.infer<typeof insertUsherAvailabilitySchema>;
export type UsherAvailability = typeof usherAvailabilityTable.$inferSelect;
