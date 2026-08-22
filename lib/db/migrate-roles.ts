/**
 * One-time migration: migrate coordinator role -> admin
 * Run with: pnpm tsx lib/db/migrate-roles.ts
 */
import { db } from "./src/index.js";
import { adminsTable } from "./src/schema/admins.js";
import { eq, sql } from "drizzle-orm";

async function main() {
  // Migrate coordinators to admin
  const result = await db
    .update(adminsTable)
    .set({ role: "admin" })
    .where(eq(adminsTable.role, "coordinator"))
    .returning({ id: adminsTable.id, email: adminsTable.email, role: adminsTable.role });

  if (result.length === 0) {
    console.log("✅ No coordinator accounts found — no migration needed.");
  } else {
    console.log(`✅ Migrated ${result.length} coordinator(s) to admin:`);
    result.forEach(r => console.log(`   - ID ${r.id}: ${r.email} → ${r.role}`));
  }

  // Verify final state
  const allAdmins = await db
    .select({ id: adminsTable.id, email: adminsTable.email, role: adminsTable.role })
    .from(adminsTable)
    .orderBy(adminsTable.id);

  console.log("\n📋 Current admin accounts:");
  allAdmins.forEach(a => console.log(`   - ID ${a.id}: ${a.email} (${a.role})`));

  process.exit(0);
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
