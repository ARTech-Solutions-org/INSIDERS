import { pgTable, serial, varchar, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ushersTable = pgTable("ushers", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  nationalIdNumber: varchar("national_id_number", { length: 100 }).unique().notNull(),
  nationalIdDocUrl: text("national_id_doc_url"),
  nationalIdDocKey: text("national_id_doc_key"),
  profilePhotoUrl: text("profile_photo_url"),
  profilePhotoKey: text("profile_photo_key"),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  gender: varchar("gender", { length: 20 }),
  homeLat: real("home_lat"),
  homeLng: real("home_lng"),
  avgRating: real("avg_rating").default(0.0),
  balance: real("balance").default(0.0),
  paymentMethod: varchar("payment_method", { length: 50 }),
  paymentMethodDetails: varchar("payment_method_details", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUsherSchema = createInsertSchema(ushersTable).omit({ id: true, createdAt: true, avgRating: true, balance: true, status: true });
export type InsertUsher = z.infer<typeof insertUsherSchema>;
export type Usher = typeof ushersTable.$inferSelect;
