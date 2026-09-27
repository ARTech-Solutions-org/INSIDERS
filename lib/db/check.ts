import { db } from "./src/index.js";
import { eventChatsTable } from "./src/schema/event-chats.js";
import { eq } from "drizzle-orm";
async function check() {
  try {
    const chats = await db.select().from(eventChatsTable).where(eq(eventChatsTable.eventId, 34));
    console.log(chats);
  } catch (e) {
    console.error(e);
  }
}
check();
