import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";

export const eventTeamsTable = pgTable("event_teams", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  instructions: text("instructions"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventTeamSchema = createInsertSchema(eventTeamsTable).omit({ id: true, createdAt: true });
export type InsertEventTeam = z.infer<typeof insertEventTeamSchema>;
export type EventTeam = typeof eventTeamsTable.$inferSelect;
