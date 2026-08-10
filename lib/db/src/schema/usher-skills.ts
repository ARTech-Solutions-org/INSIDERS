import { pgTable, serial, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ushersTable } from "./ushers";

export const usherSkillsTable = pgTable("usher_skills", {
  id: serial("id").primaryKey(),
  usherId: integer("usher_id").notNull().references(() => ushersTable.id, { onDelete: "cascade" }),
  skillType: varchar("skill_type", { length: 100 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
});

export const insertUsherSkillSchema = createInsertSchema(usherSkillsTable).omit({ id: true });
export type InsertUsherSkill = z.infer<typeof insertUsherSkillSchema>;
export type UsherSkill = typeof usherSkillsTable.$inferSelect;
