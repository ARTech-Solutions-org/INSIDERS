import { db } from "../../../lib/db/src/index.js";
import { ushersTable } from "../../../lib/db/src/schema/ushers.js";
import { usherSkillsTable } from "../../../lib/db/src/schema/usher-skills.js";
import { eq } from "drizzle-orm";

async function migrateLanguages() {
  console.log("Starting language migration...");
  
  // 1. Get all languages from usherSkillsTable
  const skills = await db.select().from(usherSkillsTable).where(eq(usherSkillsTable.skillType, 'language'));
  
  // 2. Group by usherId
  const userLangs = new Map<number, string[]>();
  for (const skill of skills) {
    if (!userLangs.has(skill.usherId)) {
      userLangs.set(skill.usherId, []);
    }
    userLangs.get(skill.usherId)!.push(skill.value);
  }

  // 3. For each usher, merge with existing languages in ushersTable
  const ushers = await db.select().from(ushersTable);
  for (const usher of ushers) {
    const dbLangs = Array.isArray(usher.languages) ? usher.languages as string[] : [];
    const skillLangs = userLangs.get(usher.id) || [];
    
    // Merge and deduplicate
    const mergedLangs = Array.from(new Set([...dbLangs, ...skillLangs]));
    
    // Only update if there's a difference
    if (mergedLangs.length !== dbLangs.length || !mergedLangs.every(l => dbLangs.includes(l))) {
      await db.update(ushersTable).set({ languages: mergedLangs }).where(eq(ushersTable.id, usher.id));
      console.log(`Updated languages for user ${usher.id}: ${mergedLangs.join(', ')}`);
    }
  }

  // 4. Delete the language entries from usherSkillsTable
  await db.delete(usherSkillsTable).where(eq(usherSkillsTable.skillType, 'language'));
  console.log("Deleted old language entries from usherSkillsTable");

  console.log("Migration complete!");
}

migrateLanguages().catch(console.error).finally(() => process.exit(0));
