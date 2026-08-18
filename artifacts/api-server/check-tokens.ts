import { db, usherPushTokensTable } from '@workspace/db';
async function main() {
  const tokens = await db.select().from(usherPushTokensTable);
  console.log('Tokens in DB:', tokens);
  process.exit(0);
}
main().catch(console.error);
