import { Router } from "express";
import { db, ratingsTable, eventAssignmentsTable, ushersTable, eventHolderLinksTable, eventsTable, eventFeedbackTable, systemSettingsTable, DEFAULT_RATING_CONFIG } from "@workspace/db";
import { eq, avg, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { CreateRatingBody, SubmitHolderRatingBody } from "@workspace/api-zod";
import { recalculateUsherCompositeRating } from "../lib/auto-rating-engine.js";

const router = Router();

// POST /ratings
router.post("/ratings", requireAuth, async (req, res) => {
  const parsed = CreateRatingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  
  // Check if a rating already exists for this assignment
  const existing = await db
    .select()
    .from(ratingsTable)
    .where(eq(ratingsTable.eventAssignmentId, parsed.data.eventAssignmentId));

  let rating;
  if (existing.length > 0) {
    // Update existing rating with admin manual rating
    [rating] = await db
      .update(ratingsTable)
      .set({
        ratingValue: parsed.data.ratingValue,
        comment: parsed.data.comment,
        ratedByType: parsed.data.ratedByType || "admin",
      })
      .where(eq(ratingsTable.id, existing[0].id))
      .returning();
  } else {
    // Insert new rating
    [rating] = await db.insert(ratingsTable).values(parsed.data).returning();
  }

  const [assignment] = await db.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.id, rating?.eventAssignmentId || parsed.data.eventAssignmentId));
  if (assignment) recalculateUsherCompositeRating(assignment.usherId).catch(() => {});
  res.status(201).json(rating || { success: true });
});

// POST /ratings/holder/:token (public)
router.post("/ratings/holder/:token", async (req, res) => {
  const parsed = SubmitHolderRatingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [link] = await db.select().from(eventHolderLinksTable).where(eq(eventHolderLinksTable.uniqueToken, req.params.token));
  if (!link) { res.status(404).json({ error: "Invalid token" }); return; }
  const [rating] = await db.insert(ratingsTable).values({ ...parsed.data, ratedByType: "holder" }).returning();
  const [assignment] = await db.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.id, rating.eventAssignmentId));
  if (assignment) recalculateUsherCompositeRating(assignment.usherId).catch(() => {});
  res.status(201).json(rating);
});

// GET /my/ratings
router.get("/my/ratings", requireAuth, async (req, res) => {
  const usherId = req.user!.id;
  const assignments = await db
    .select({ 
      id: eventAssignmentsTable.id, 
      eventId: eventAssignmentsTable.eventId,
      eventTeamId: eventAssignmentsTable.eventTeamId,
      status: eventAssignmentsTable.status,
      lateArrivalMinutes: eventAssignmentsTable.lateArrivalMinutes,
      earlyLeaveMinutes: eventAssignmentsTable.earlyLeaveMinutes,
      checkinTime: eventAssignmentsTable.checkinTime
    })
    .from(eventAssignmentsTable)
    .where(eq(eventAssignmentsTable.usherId, usherId));
  
  if (!assignments.length) { res.json([]); return; }
  
  const assignmentIds = assignments.map(a => a.id);
  const ratings = await db.select().from(ratingsTable).where(inArray(ratingsTable.eventAssignmentId, assignmentIds));
  
  // Load event info for each assignment
  const eventIds = [...new Set(assignments.map(a => a.eventId))];
  const events = await db
    .select({ id: eventsTable.id, title: eventsTable.title, startTime: eventsTable.startTime })
    .from(eventsTable)
    .where(inArray(eventsTable.id, eventIds));
  const eventMap = new Map(events.map(e => [e.id, e]));
  const assignmentMap = new Map(assignments.map(a => [a.id, a]));

  const result: any[] = ratings.map(r => {
    const assignment = assignmentMap.get(r.eventAssignmentId);
    const event = assignment ? eventMap.get(assignment.eventId) : undefined;
    return { ...r, eventTitle: event?.title ?? null, eventStartTime: event?.startTime ?? null };
  });

  // Load rating config
  const [configRow] = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "ratingConfig"));
  const ratingConfig = configRow ? (configRow.value as typeof DEFAULT_RATING_CONFIG) : DEFAULT_RATING_CONFIG;

  // Inject synthetic system ratings for completed assignments
  for (const a of assignments) {
    if (a.status === 'completed' && a.checkinTime) {
      // Check if there is already a system rating in the DB for this assignment (legacy support)
      if (ratings.some(r => r.eventAssignmentId === a.id && r.ratedByType === 'system')) {
        continue;
      }

      let score = 5;
      let notes = [];
      const late = a.lateArrivalMinutes || 0;
      const early = a.earlyLeaveMinutes || 0;
      const { gracePeriodMinutes, punctualityPenaltyPerInterval, punctualityIntervalMinutes } = ratingConfig;
      
      const lateBeyondGrace = Math.max(0, late - gracePeriodMinutes);
      if (lateBeyondGrace > 0) {
        const deduction = Math.floor(lateBeyondGrace / punctualityIntervalMinutes) * punctualityPenaltyPerInterval;
        if (deduction > 0) {
          score -= deduction;
          notes.push(`Checked in ${late} mins late (-${deduction} star${deduction > 1 ? 's' : ''})`);
        }
      }
      
      const earlyBeyondGrace = Math.max(0, early - gracePeriodMinutes);
      if (earlyBeyondGrace > 0) {
        const deduction = Math.floor(earlyBeyondGrace / punctualityIntervalMinutes) * punctualityPenaltyPerInterval;
        if (deduction > 0) {
          score -= deduction;
          notes.push(`Checked out ${early} mins early (-${deduction} star${deduction > 1 ? 's' : ''})`);
        }
      }
      
      
      score = Math.max(0, Math.min(5, score));
      
      if (notes.length > 0 || score < 5) {
        const event = eventMap.get(a.eventId);
        result.push({
          id: -a.id, // negative ID to ensure uniqueness for React key
          eventAssignmentId: a.id,
          ratedByType: 'system',
          ratingValue: score,
          comment: `System Auto-Rating: ${notes.length > 0 ? notes.join(', ') : 'Punctuality affected score.'}`,
          eventTitle: event?.title ?? null,
          eventStartTime: event?.startTime ?? null
        });
      }
    }
  }

  // Inject client ratings from eventFeedbackTable
  if (eventIds.length > 0) {
    const feedbackRows = await db
      .select({ 
        eventId: eventFeedbackTable.eventId,
        usherOverrides: eventFeedbackTable.usherOverrides,
        teamRatings: eventFeedbackTable.teamRatings
      })
      .from(eventFeedbackTable)
      .where(inArray(eventFeedbackTable.eventId, eventIds));

    for (const row of feedbackRows) {
      const assignment = assignments.find(a => a.eventId === row.eventId);
      if (!assignment) continue;
      
      let overrideRating: number | null = null;
      let overrideComment: string | null = null;
      
      // Check if usher has an explicit override
      if (row.usherOverrides) {
        try {
          const overrides = typeof row.usherOverrides === "string" 
            ? JSON.parse(row.usherOverrides) 
            : (row.usherOverrides as any[]);
          const match = overrides.find((o: any) => o.usherId === usherId);
          if (match && match.rating > 0) {
            overrideRating = match.rating;
            overrideComment = match.comments || null;
          }
        } catch {}
      }

      if (overrideRating !== null) {
        const event = eventMap.get(row.eventId);
        result.push({
          id: -(assignment.id * 1000), // unique ID for React key
          eventAssignmentId: assignment.id,
          ratedByType: 'client',
          ratingValue: overrideRating,
          comment: overrideComment || "Client specific rating for you.",
          eventTitle: event?.title ?? null,
          eventStartTime: event?.startTime ?? null
        });
      } else if (row.teamRatings) {
        // Fallback to their team rating for that event
        try {
          const teamId = (assignment as any).eventTeamId || 0; 
          // Note: we need to get eventTeamId from assignments, but it's not currently selected!
          // We must update the assignment select above to include eventTeamId.
          const teamRatings = typeof row.teamRatings === "string"
            ? JSON.parse(row.teamRatings)
            : (row.teamRatings as any[]);
          
          const match = teamRatings.find((t: any) => t.teamId === teamId);
          if (match && match.rating > 0) {
            const event = eventMap.get(row.eventId);
            result.push({
              id: -(assignment.id * 1000), // unique ID for React key
              eventAssignmentId: assignment.id,
              ratedByType: 'client',
              ratingValue: match.rating,
              comment: match.comments || "Client rating for your team.",
              eventTitle: event?.title ?? null,
              eventStartTime: event?.startTime ?? null
            });
          }
        } catch {}
      }
    }
  }

  // Sort by event start time descending
  result.sort((a, b) => {
    const timeA = a.eventStartTime ? new Date(a.eventStartTime).getTime() : 0;
    const timeB = b.eventStartTime ? new Date(b.eventStartTime).getTime() : 0;
    return timeB - timeA;
  });

  res.json(result);
});

export default router;
