import { db } from "./src/index.js";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying manual migrations...");
  try {
    await db.execute(sql`ALTER TABLE "events" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;`);
    console.log("Added version to events");
  } catch (e) { console.log(e.message); }

  try {
    await db.execute(sql`ALTER TABLE "ushers" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;`);
    console.log("Added version to ushers");
  } catch (e) { console.log(e.message); }

  try {
    // delete duplicates from event_assignments (keeping the one with the smallest id)
    await db.execute(sql`
      DELETE FROM "event_assignments"
      WHERE "id" NOT IN (
        SELECT MIN("id")
        FROM "event_assignments"
        GROUP BY "usher_id", "event_id"
      );
    `);
    console.log("Deduplicated event_assignments");
    
    await db.execute(sql`ALTER TABLE "event_assignments" ADD CONSTRAINT "usher_event_unique" UNIQUE("usher_id","event_id");`);
    console.log("Added unique constraint to event_assignments");
  } catch (e) { console.log(e.message); }

  console.log("Done");
  process.exit(0);
}

main();
