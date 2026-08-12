import { pgTable, serial, integer, date, boolean, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ushersTable } from "./ushers";

export const usherAvailabilityTable = pgTable("usher_availability", {
  id: serial("id").primaryKey(),
  usherId: integer("usher_id").notNull().references(() => ushersTable.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  startTime: text("start_time").notNull().default("00:00"),
  endTime: text("end_time").notNull().default("23:59"),
});

export const insertUsherAvailabilitySchema = createInsertSchema(usherAvailabilityTable).omit({ id: true });
export type InsertUsherAvailability = z.infer<typeof insertUsherAvailabilitySchema>;
export type UsherAvailability = typeof usherAvailabilityTable.$inferSelect;
