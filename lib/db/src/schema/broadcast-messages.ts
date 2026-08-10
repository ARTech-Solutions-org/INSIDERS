import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { adminsTable } from "./admins";

export const broadcastMessagesTable = pgTable("broadcast_messages", {
  id: serial("id").primaryKey(),
  sentByAdminId: integer("sent_by_admin_id").references(() => adminsTable.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  targetFilter: text("target_filter"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBroadcastMessageSchema = createInsertSchema(broadcastMessagesTable).omit({ id: true, sentAt: true });
export type InsertBroadcastMessage = z.infer<typeof insertBroadcastMessageSchema>;
export type BroadcastMessage = typeof broadcastMessagesTable.$inferSelect;
