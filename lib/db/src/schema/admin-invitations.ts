import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { adminsTable } from "./admins";

export const adminInvitationsTable = pgTable("admin_invitations", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 255 }).unique().notNull(),
  createdByAdminId: integer("created_by_admin_id").references(() => adminsTable.id, { onDelete: "cascade" }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdminInvitationSchema = createInsertSchema(adminInvitationsTable).omit({ id: true, createdAt: true });
export type InsertAdminInvitation = z.infer<typeof insertAdminInvitationSchema>;
export type AdminInvitation = typeof adminInvitationsTable.$inferSelect;
