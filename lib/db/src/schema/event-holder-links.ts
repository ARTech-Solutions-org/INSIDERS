import { pgTable, serial, integer, varchar, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";

export const eventHolderLinksTable = pgTable("event_holder_links", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").unique().notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  uniqueToken: varchar("unique_token", { length: 255 }).unique().notNull(),
});

export const insertEventHolderLinkSchema = createInsertSchema(eventHolderLinksTable).omit({ id: true });
export type InsertEventHolderLink = z.infer<typeof insertEventHolderLinkSchema>;
export type EventHolderLink = typeof eventHolderLinksTable.$inferSelect;
