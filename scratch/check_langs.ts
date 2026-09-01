import { db } from "../lib/db/src";
import { ushersTable } from "../lib/db/src/schema";

async function main() {
  const ushers = await db.select({ id: ushersTable.id, fullName: ushersTable.fullName, languages: ushersTable.languages }).from(ushersTable).limit(5);
  console.log(JSON.stringify(ushers, null, 2));
  process.exit(0);
}
main().catch(console.error);
