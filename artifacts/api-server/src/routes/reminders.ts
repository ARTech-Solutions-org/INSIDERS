import { Router } from "express";
import { db, eventsTable, eventAssignmentsTable, ushersTable } from "@workspace/db";
import { and, gte, lte, eq, inArray, lt, ne } from "drizzle-orm";
import { sendPushToUsher } from "../lib/fcm.js";

const router = Router();

/**
 * POST /api/send-event-reminders
 *
 * Cron-triggered endpoint that:
 *  1. Finds events starting in 23h55m–24h05m from now.
 *  2. For each event, finds assignments where reminder_sent = false.
 *  3. Sends FCM push to each usher.
 *  4. Marks reminder_sent = true.
 *
 * Protected by a secret key in the Authorization header:
 *   Authorization: Bearer <REMINDER_SECRET>
 *
 * TODO: Set REMINDER_SECRET in your .env (api-server) and on Vercel's
 *       environment-variable settings, and as a GitHub Secret named REMINDER_SECRET.
 */
router.post("/send-event-reminders", async (req, res) => {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const secret = process.env.REMINDER_SECRET;
  if (!secret) {
    console.warn("[Reminders] REMINDER_SECRET is not configured. Endpoint is disabled.");
    res.status(503).json({ error: "Reminders not configured" });
    return;
  }

  const authHeader = req.headers.authorization ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // --- 1. Auto-complete events whose end time has passed ---
  try {
    await db
      .update(eventsTable)
      .set({ status: "completed" })
      .where(
        and(
          lt(eventsTable.endTime, new Date()),
          ne(eventsTable.status, "completed")
        )
      );
  } catch (err) {
    console.error("[Cron] Failed to auto-complete events:", err);
  }

  // --- 2. Find events starting in the next 24 hours ───────────────────────────────────────
  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000); // exactly 24 hours from now

  const upcomingEvents = await db
    .select()
    .from(eventsTable)
    .where(
      and(
        gte(eventsTable.startTime, now),
        lte(eventsTable.startTime, next24Hours)
      )
    );

  if (upcomingEvents.length === 0) {
    res.json({ sent: 0, message: "No events in the 24-hour window." });
    return;
  }

  let totalSent = 0;

  for (const event of upcomingEvents) {
    // Find assignments that haven't had a reminder sent yet
    const assignments = await db
      .select({ id: eventAssignmentsTable.id, usherId: eventAssignmentsTable.usherId })
      .from(eventAssignmentsTable)
      .where(
        and(
          eq(eventAssignmentsTable.eventId, event.id),
          inArray(eventAssignmentsTable.status, ["assigned", "accepted"]),
          eq(eventAssignmentsTable.reminderSent, false)
        )
      );

    if (assignments.length === 0) continue;

    // Format event start time nicely
    const startLabel = new Date(event.startTime).toLocaleString("ar-EG", {
      dateStyle: "short",
      timeStyle: "short",
    });

    // Send FCM push to each usher (in parallel per event)
    await Promise.all(
      assignments.map((a) =>
        sendPushToUsher(a.usherId, {
          title: "Event Reminder 🔔",
          body: `Your event "${event.title}" starts tomorrow at ${startLabel}. Be ready!`,
          data: { eventId: String(event.id), type: "event_reminder" },
        })
      )
    );

    // Mark reminder_sent = true for all processed assignments
    const assignmentIds = assignments.map((a) => a.id);
    await db
      .update(eventAssignmentsTable)
      .set({ reminderSent: true })
      .where(inArray(eventAssignmentsTable.id, assignmentIds));

    totalSent += assignments.length;
  }

  console.log(`[Reminders] Sent ${totalSent} reminder(s) across ${upcomingEvents.length} event(s).`);
  res.json({ sent: totalSent, events: upcomingEvents.length });
});

export default router;
