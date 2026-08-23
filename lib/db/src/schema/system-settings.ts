import { pgTable, serial, varchar, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { adminsTable } from "./admins";

export interface RatingConfig {
  clientRatingWeight: number;
  punctualityWeight: number;
  reliabilityWeight: number;
  gracePeriodMinutes: number;
  punctualityPenaltyPerInterval: number;
  punctualityIntervalMinutes: number;
  reliabilityWindowDays: number;
  noShowPenalty: number;
  lateCancellationPenalty: number;
  lateCancellationWindowHours: number;
  reliabilityFlagThreshold: number;
}

export const DEFAULT_RATING_CONFIG: RatingConfig = {
  clientRatingWeight: 0.5,
  punctualityWeight: 0.3,
  reliabilityWeight: 0.2,
  gracePeriodMinutes: 10,
  punctualityPenaltyPerInterval: 0.5,
  punctualityIntervalMinutes: 15,
  reliabilityWindowDays: 90,
  noShowPenalty: 1.0,
  lateCancellationPenalty: 0.5,
  lateCancellationWindowHours: 24,
  reliabilityFlagThreshold: 3,
};

export const systemSettingsTable = pgTable("system_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  updatedByAdminId: integer("updated_by_admin_id").references(() => adminsTable.id, { onDelete: "set null" }),
});
