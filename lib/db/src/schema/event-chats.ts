import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { adminsTable } from "./admins";

export const eventChatsTable = pgTable("event_chats", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  adminId: integer("admin_id").notNull().references(() => adminsTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventChatSchema = createInsertSchema(eventChatsTable).omit({ id: true, createdAt: true });
export type InsertEventChat = z.infer<typeof insertEventChatSchema>;
export type EventChat = typeof eventChatsTable.$inferSelect;
