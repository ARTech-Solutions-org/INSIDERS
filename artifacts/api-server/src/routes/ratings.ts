import { Router } from "express";
import { db, ratingsTable, eventAssignmentsTable, ushersTable, eventHolderLinksTable, eventsTable } from "@workspace/db";
import { eq, avg, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { CreateRatingBody, SubmitHolderRatingBody } from "@workspace/api-zod";

const router = Router();

async function updateAvgRating(usherId: number) {
  const assignments = await db.select({ id: eventAssignmentsTable.id }).from(eventAssignmentsTable).where(eq(eventAssignmentsTable.usherId, usherId));
  const assignmentIds = assignments.map(a => a.id);
  if (!assignmentIds.length) return;
  const rows = await db.select({ id: ratingsTable.id, ratingValue: ratingsTable.ratingValue }).from(ratingsTable).where(eq(ratingsTable.eventAssignmentId, assignmentIds[0]));
  // approximate: recompute from all ratings for this usher's assignments
  const allRatings = await Promise.all(assignmentIds.map(id => db.select({ ratingValue: ratingsTable.ratingValue }).from(ratingsTable).where(eq(ratingsTable.eventAssignmentId, id))));
  const flat = allRatings.flat();
  if (!flat.length) return;
  const avg = flat.reduce((s, r) => s + r.ratingValue, 0) / flat.length;
  await db.update(ushersTable).set({ avgRating: avg }).where(eq(ushersTable.id, usherId));
}

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

  const [assignment] = await db.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.id, rating.eventAssignmentId));
  if (assignment) await updateAvgRating(assignment.usherId);
  res.status(201).json(rating);
});

// POST /ratings/holder/:token (public)
router.post("/ratings/holder/:token", async (req, res) => {
  const parsed = SubmitHolderRatingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [link] = await db.select().from(eventHolderLinksTable).where(eq(eventHolderLinksTable.uniqueToken, req.params.token));
  if (!link) { res.status(404).json({ error: "Invalid token" }); return; }
  const [rating] = await db.insert(ratingsTable).values({ ...parsed.data, ratedByType: "holder" }).returning();
  const [assignment] = await db.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.id, rating.eventAssignmentId));
  if (assignment) await updateAvgRating(assignment.usherId);
  res.status(201).json(rating);
});

// GET /my/ratings
router.get("/my/ratings", requireAuth, async (req, res) => {
  const usherId = req.user!.id;
  const assignments = await db
    .select({ id: eventAssignmentsTable.id, eventId: eventAssignmentsTable.eventId })
    .from(eventAssignmentsTable)
    .where(eq(eventAssignmentsTable.usherId, usherId));
  
  if (!assignments.length) { res.json([]); return; }
  
  const assignmentIds = assignments.map(a => a.id);
  const ratings = await db.select().from(ratingsTable).where(inArray(ratingsTable.eventAssignmentId, assignmentIds));
  
  if (!ratings.length) { res.json([]); return; }

  // Load event info for each assignment
  const eventIds = [...new Set(assignments.map(a => a.eventId))];
  const events = await db
    .select({ id: eventsTable.id, title: eventsTable.title, startTime: eventsTable.startTime })
    .from(eventsTable)
    .where(inArray(eventsTable.id, eventIds));
  const eventMap = new Map(events.map(e => [e.id, e]));
  const assignmentMap = new Map(assignments.map(a => [a.id, a]));

  const result = ratings.map(r => {
    const assignment = assignmentMap.get(r.eventAssignmentId);
    const event = assignment ? eventMap.get(assignment.eventId) : undefined;
    return { ...r, eventTitle: event?.title ?? null, eventStartTime: event?.startTime ?? null };
  });

  res.json(result);
});

export default router;
