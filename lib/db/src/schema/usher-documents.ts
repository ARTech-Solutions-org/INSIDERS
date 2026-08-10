import { pgTable, serial, integer, varchar, text, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ushersTable } from "./ushers";

export const usherDocumentsTable = pgTable("usher_documents", {
  id: serial("id").primaryKey(),
  usherId: integer("usher_id").notNull().references(() => ushersTable.id, { onDelete: "cascade" }),
  docType: varchar("doc_type", { length: 100 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileKey: text("file_key").notNull(),
  expiryDate: date("expiry_date", { mode: "string" }),
  status: varchar("status", { length: 50 }).default("pending"),
});

export const insertUsherDocumentSchema = createInsertSchema(usherDocumentsTable).omit({ id: true });
export type InsertUsherDocument = z.infer<typeof insertUsherDocumentSchema>;
export type UsherDocument = typeof usherDocumentsTable.$inferSelect;
