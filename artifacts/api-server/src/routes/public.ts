import { Router } from "express";
import { db, eventFeedbackLinksTable, eventsTable, eventTeamsTable, eventAssignmentsTable, ushersTable, eventFeedbackTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { SubmitPublicEventFeedbackBody } from "@workspace/api-zod";
import { recalculateUsherCompositeRating } from "../lib/auto-rating-engine.js";

const router = Router();

// GET /public/feedback/:token
router.get("/feedback/:token", async (req, res) => {
  const token = req.params.token;
  
  const [link] = await db.select().from(eventFeedbackLinksTable).where(
    and(
      eq(eventFeedbackLinksTable.token, token),
      isNull(eventFeedbackLinksTable.revokedAt)
    )
  );

  if (!link) {
    res.status(404).json({ error: "Feedback link not found or revoked" });
    return;
  }

  // Check if already submitted
  if (link.submittedAt) {
    res.status(403).json({ error: "Feedback has already been submitted for this link" });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, link.eventId));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const teams = await db.select().from(eventTeamsTable).where(eq(eventTeamsTable.eventId, event.id));
  const assignments = await db.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.eventId, event.id));
  const ushers = await db.select().from(ushersTable);

  const teamsWithUshers = teams.map(t => {
    const teamAssignments = assignments.filter(a => a.eventTeamId === t.id);
    const teamUshers = teamAssignments.map(a => {
      const u = ushers.find(u => u.id === a.usherId);
      return { id: a.usherId, name: u?.fullName || "Unknown" };
    });
    return { id: t.id, name: t.name, ushers: teamUshers };
  });

  const unassignedAssignments = assignments.filter(a => !a.eventTeamId);
  if (unassignedAssignments.length > 0) {
    const unassignedUshers = unassignedAssignments.map(a => {
      const u = ushers.find(u => u.id === a.usherId);
      return { id: a.usherId, name: u?.fullName || "Unknown" };
    });
    teamsWithUshers.push({
      id: 0,
      name: "General",
      ushers: unassignedUshers
    });
  }

  res.json({
    id: event.id,
    title: event.title,
    eventLocName: event.eventLocName,
    startTime: event.startTime,
    endTime: event.endTime,
    teams: teamsWithUshers
  });
});

// POST /public/feedback/:token
router.post("/feedback/:token", async (req, res) => {
  const token = req.params.token;
  
  const parsed = SubmitPublicEventFeedbackBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  try {
    const eventId = await db.transaction(async (tx) => {
      // Use FOR UPDATE to lock the row and prevent race conditions (double submission)
      // Drizzle ORM does not directly expose FOR UPDATE on select easily without raw sql or specific dialect features,
      // but we can check and update atomically.
      
      // Update link atomically if not submitted
      const [updatedLink] = await tx.update(eventFeedbackLinksTable)
        .set({ submittedAt: new Date() })
        .where(
          and(
            eq(eventFeedbackLinksTable.token, token),
            isNull(eventFeedbackLinksTable.revokedAt),
            isNull(eventFeedbackLinksTable.submittedAt)
          )
        ).returning();

      if (!updatedLink) {
        throw new Error("Link is invalid or already submitted");
      }

      await tx.insert(eventFeedbackTable).values({
        eventId: updatedLink.eventId,
        linkId: updatedLink.id,
        overallRating: parsed.data.overallRating,
        comment: parsed.data.comment || null,
        teamRatings: parsed.data.teamRatings ? JSON.stringify(parsed.data.teamRatings) : null,
        usherOverrides: parsed.data.usherOverrides ? JSON.stringify(parsed.data.usherOverrides) : null
      });

      return updatedLink.eventId;
    });

    // Fire-and-forget: recalculate composite rating for all ushers assigned to this event
    // since team ratings could affect ushers who weren't explicitly overridden.
    db.select({ usherId: eventAssignmentsTable.usherId })
      .from(eventAssignmentsTable)
      .where(eq(eventAssignmentsTable.eventId, eventId))
      .then((assignments) => {
        const usherIds = [...new Set(assignments.map((a) => a.usherId))];
        for (const uid of usherIds) {
          recalculateUsherCompositeRating(uid).catch(() => {});
        }
      })
      .catch(() => {});

    res.json({ success: true });
  } catch (err: any) {
    if (err.message === "Link is invalid or already submitted") {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router;
