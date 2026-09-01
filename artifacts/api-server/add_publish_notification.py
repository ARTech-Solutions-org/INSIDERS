import os

fcm_path = r"f:\ARTech\Usher-Management\Usher-Management\artifacts\api-server\src\lib\fcm.ts"

with open(fcm_path, "r", encoding="utf-8") as f:
    fcm_content = f.read()

if "sendPushToAllUshers" not in fcm_content:
    if "import { db, usherPushTokensTable" in fcm_content:
        fcm_content = fcm_content.replace(
            "import { db, usherPushTokensTable } from \"@workspace/db\";",
            "import { db, usherPushTokensTable, ushersTable } from \"@workspace/db\";"
        )
    
    new_function = """
/**
 * Sends a push notification to all active ushers.
 */
export async function sendPushToAllUshers(payload: PushPayload): Promise<void> {
  const activeUshers = await db.select({ id: ushersTable.id }).from(ushersTable).where(eq(ushersTable.status, "active"));
  const usherIds = activeUshers.map((u) => u.id);
  if (usherIds.length > 0) {
    await sendPushToUshers(usherIds, payload);
  }
}
"""
    fcm_content += new_function
    with open(fcm_path, "w", encoding="utf-8") as f:
        f.write(fcm_content)

events_path = r"f:\ARTech\Usher-Management\Usher-Management\artifacts\api-server\src\routes\events.ts"

with open(events_path, "r", encoding="utf-8") as f:
    events_content = f.read()

# Fix import in events.ts
if "sendPushToAllUshers" not in events_content:
    events_content = events_content.replace(
        "import { sendPushToUsher, sendPushToUshers } from \"../lib/fcm.js\";",
        "import { sendPushToUsher, sendPushToUshers, sendPushToAllUshers } from \"../lib/fcm.js\";"
    )

# POST /events
post_events = """  await audit(req.user!.id, "CREATE_EVENT", "events", event.id);
  res.status(201).json(event);
});"""

post_events_replacement = """  await audit(req.user!.id, "CREATE_EVENT", "events", event.id);

  if (event.status === "published") {
    // Notify all active ushers about the new event
    await sendPushToAllUshers({
      title: "New Event Available 📣",
      body: `A new event "${event.title}" is now available. Apply now!`,
      data: { eventId: String(event.id), type: "event_published" },
    });
  }

  res.status(201).json(event);
});"""

events_content = events_content.replace(post_events, post_events_replacement)


# PATCH /events/:id
patch_events = """      const newVersion = existing.version + 1;
      const [updated] = await tx.update(eventsTable)
        .set({ ...parsed.data, version: newVersion, superAdminLockedFields: newLockedFields })
        .where(and(eq(eventsTable.id, eventId), eq(eventsTable.version, existing.version)))
        .returning();
      
      if (!updated) throw new Error("Conflict");
      await audit(req.user!.id, "UPDATE_EVENT", "events", updated.id);
      return { updated, oldStatus: existing.status };
    });
    
    if (eventData.updated.status === "published" && eventData.oldStatus !== "published") {
      await sendPushToAllUshers({
        title: "New Event Available 📣",
        body: `A new event "${eventData.updated.title}" is now available. Apply now!`,
        data: { eventId: String(eventData.updated.id), type: "event_published" },
      });
    }

    sseManager.broadcast("EVENT_UPDATED", { id: eventData.updated.id });
    res.json(eventData.updated);"""

# Wait, let's look at the current PATCH /events/:id closely.
