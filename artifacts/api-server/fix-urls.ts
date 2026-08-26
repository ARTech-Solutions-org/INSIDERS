import { db } from "@workspace/db";
import { ushersTable } from "@workspace/db/src/schema/ushers";
import { eq, isNotNull, like } from "drizzle-orm";

async function main() {
  const ushers = await db.select().from(ushersTable).where(isNotNull(ushersTable.profilePhotoKey));
  console.log(`Found ${ushers.length} ushers with profile photos`);

  const baseUrl = process.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:3000';

  let updated = 0;
  for (const usher of ushers) {
    if (usher.profilePhotoUrl && usher.profilePhotoUrl.includes('amazonaws.com') || usher.profilePhotoUrl?.includes('r2.cloudflarestorage.com')) {
      const proxyUrl = `${baseUrl}/api/uploads/read?key=${encodeURIComponent(usher.profilePhotoKey!)}`;
      await db.update(ushersTable).set({ profilePhotoUrl: proxyUrl }).where(eq(ushersTable.id, usher.id));
      updated++;
      console.log(`Updated photo url for ${usher.fullName}`);
    }
  }

  console.log(`Done. Updated ${updated} ushers.`);
  process.exit(0);
}

main().catch(console.error);
