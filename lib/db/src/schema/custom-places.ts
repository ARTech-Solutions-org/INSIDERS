import { pgTable, uuid, varchar, doublePrecision, timestamp } from "drizzle-orm/pg-core";

export const customPlacesTable = pgTable("custom_places", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  category: varchar("category", { length: 100 }),
  keywords: varchar("keywords", { length: 500 }), // Comma separated or space separated searchable terms
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
