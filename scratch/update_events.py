import re

path = 'artifacts/api-server/src/routes/events.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

replacement_1 = """  if (event.status === "published") {
    const activeUshers = await db.select({ id: ushersTable.id }).from(ushersTable).where(eq(ushersTable.status, "active"));
    if (activeUshers.length > 0) {
      await db.insert(notificationsTable).values(
        activeUshers.map(u => ({
          recipientType: "usher",
          recipientId: u.id,
          type: "event_published",
          message: `A new event "${event.title}" is now available. Apply now!`
        }))
      );
    }
    await sendPushToAllUshers({
      title: "New Event Available 📣",
      body: `A new event "${event.title}" is now available. Apply now!`,
      data: { eventId: String(event.id), type: "event_published" },
    });
  }"""

content = re.sub(
    r'  if \(event\.status === "published"\) {\s*await sendPushToAllUshers\({[^}]*}\);\s*}',
    replacement_1,
    content,
    flags=re.MULTILINE
)

replacement_2 = """    if (event.updated.status === "published" && event.oldStatus !== "published") {
      const activeUshers = await db.select({ id: ushersTable.id }).from(ushersTable).where(eq(ushersTable.status, "active"));
      if (activeUshers.length > 0) {
        await db.insert(notificationsTable).values(
          activeUshers.map(u => ({
            recipientType: "usher",
            recipientId: u.id,
            type: "event_published",
            message: `A new event "${event.updated.title}" is now available. Apply now!`
          }))
        );
      }
      await sendPushToAllUshers({
        title: "New Event Available 📣",
        body: `A new event "${event.updated.title}" is now available. Apply now!`,
        data: { eventId: String(event.updated.id), type: "event_published" },
      });
    }"""

content = re.sub(
    r'    if \(event\.updated\.status === "published" && event\.oldStatus !== "published"\) {\s*await sendPushToAllUshers\({[^}]*}\);\s*}',
    replacement_2,
    content,
    flags=re.MULTILINE
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated events.ts")
