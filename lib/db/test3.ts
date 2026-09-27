import { db, eventChatsTable, adminsTable } from './src/index.js';
import { eq } from 'drizzle-orm';

async function test() {
  try {
    const eventId = 34;
    const chats = await db
      .select({
        id: eventChatsTable.id,
        eventId: eventChatsTable.eventId,
        adminId: eventChatsTable.adminId,
        message: eventChatsTable.message,
        createdAt: eventChatsTable.createdAt,
        adminName: adminsTable.name,
      })
      .from(eventChatsTable)
      .leftJoin(adminsTable, eq(eventChatsTable.adminId, adminsTable.id))
      .where(eq(eventChatsTable.eventId, eventId))
      .orderBy(eventChatsTable.createdAt);
    console.log(chats);
  } catch (err) {
    console.error(err);
  }
}
test();
