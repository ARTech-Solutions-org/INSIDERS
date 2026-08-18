import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ushersTable } from "./ushers";

export const usherPushTokensTable = pgTable("usher_push_tokens", {
  id: serial("id").primaryKey(),
  usherId: integer("usher_id").notNull().references(() => ushersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("usher_push_tokens_usher_token_idx").on(table.usherId, table.token),
]);

export const insertUsherPushTokenSchema = createInsertSchema(usherPushTokensTable).omit({ id: true, createdAt: true });
export type InsertUsherPushToken = z.infer<typeof insertUsherPushTokenSchema>;
export type UsherPushToken = typeof usherPushTokensTable.$inferSelect;
