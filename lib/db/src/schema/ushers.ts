import { pgTable, serial, varchar, text, real, timestamp, date, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ushersTable = pgTable("ushers", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  fullNameArabic: varchar("full_name_arabic", { length: 255 }),
  phone: varchar("phone", { length: 50 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  nationalIdNumber: varchar("national_id_number", { length: 100 }).unique().notNull(),
  nationalIdDocUrl: text("national_id_doc_url"),
  nationalIdDocKey: text("national_id_doc_key"),
  nationalIdDocBackUrl: text("national_id_doc_back_url"),
  nationalIdDocBackKey: text("national_id_doc_back_key"),
  profilePhotoUrl: text("profile_photo_url"),
  profilePhotoKey: text("profile_photo_key"),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  gender: varchar("gender", { length: 20 }),
  dateOfBirth: date("date_of_birth"),
  height: integer("height"),
  university: varchar("university", { length: 255 }),
  major: varchar("major", { length: 255 }),
  languages: jsonb("languages").$type<string[]>(),
  shoeSize: varchar("shoe_size", { length: 20 }),
  shirtSize: varchar("shirt_size", { length: 20 }),
  tShirtSize: varchar("t_shirt_size", { length: 20 }),
  pantsSize: varchar("pants_size", { length: 20 }),
  shortsSize: varchar("shorts_size", { length: 20 }),
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
