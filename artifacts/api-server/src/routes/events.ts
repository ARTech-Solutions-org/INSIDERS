import { Router } from "express";
import { randomBytes } from "crypto";
import { db, eventsTable, eventAssignmentsTable, deductionRulesTable, eventHolderLinksTable, waitlistTable, ushersTable } from "@workspace/db";
import { eq, and, gte, sql, desc, lt, ne } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";
import {
  CreateEventBody,
  UpdateEventBody,
  CreateDeductionRuleBody,
  AssignUsherToEventBody,
  WaitlistInput,
} from "@workspace/api-zod";

const router = Router();

function buildEventDetail(event: any, assignments: any[], deductionRules: any[]) {
  return { ...event, assignments, deductionRules };
}

// GET /events
router.get("/events", requireAuth, async (req, res) => {
  // Automatically mark events as completed if their end time has passed
  await db
    .update(eventsTable)
    .set({ status: "completed" })
    .where(
      and(
        lt(eventsTable.endTime, new Date()),
        ne(eventsTable.status, "completed")
      )
    );

  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let query = db.select().from(eventsTable).$dynamic().orderBy(desc(eventsTable.startTime));
  if (status) query = query.where(eq(eventsTable.status, status));
  const data = await query.limit(parseInt(limit)).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(eventsTable);
  res.json({ data, total: count });
});

// POST /events
router.post("/events", requireAdmin, async (req, res) => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [event] = await db.insert(eventsTable).values({ ...parsed.data, createdByAdminId: req.user!.id }).returning();
  await audit(req.user!.id, "CREATE_EVENT", "events", event.id);
  res.status(201).json(event);
});

// GET /events/:id
router.get("/events/:id", requireAuth, async (req, res) => {
  // Automatically mark events as completed if their end time has passed
  await db
    .update(eventsTable)
    .set({ status: "completed" })
    .where(
      and(
        lt(eventsTable.endTime, new Date()),
        ne(eventsTable.status, "completed")
      )
    );

  const eventId = parseInt(req.params.id as string, 10);
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event) { res.status(404).json({ error: "Not found" }); return; }
  const assignments = await db.select({ id: eventAssignmentsTable.id, eventId: eventAssignmentsTable.eventId, usherId: eventAssignmentsTable.usherId, status: eventAssignmentsTable.status, isTeamLead: eventAssignmentsTable.isTeamLead, checkinTime: eventAssignmentsTable.checkinTime, checkinLat: eventAssignmentsTable.checkinLat, checkinLng: eventAssignmentsTable.checkinLng, checkinMethod: eventAssignmentsTable.checkinMethod, checkoutTime: eventAssignmentsTable.checkoutTime, checkoutLat: eventAssignmentsTable.checkoutLat, checkoutLng: eventAssignmentsTable.checkoutLng, usher: { id: ushersTable.id, fullName: ushersTable.fullName, email: ushersTable.email, phone: ushersTable.phone, status: ushersTable.status, avgRating: ushersTable.avgRating, balance: ushersTable.balance, nationalIdNumber: ushersTable.nationalIdNumber, nationalIdDocUrl: ushersTable.nationalIdDocUrl, profilePhotoUrl: ushersTable.profilePhotoUrl, createdAt: ushersTable.createdAt } }).from(eventAssignmentsTable).leftJoin(ushersTable, eq(eventAssignmentsTable.usherId, ushersTable.id)).where(eq(eventAssignmentsTable.eventId, event.id));
  const deductionRules = await db.select().from(deductionRulesTable).where(eq(deductionRulesTable.eventId, event.id));
  res.json(buildEventDetail(event, assignments, deductionRules));
});

// PATCH /events/:id
router.patch("/events/:id", requireAdmin, async (req, res) => {
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const eventId = parseInt(req.params.id as string, 10);
  
  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "completed" || new Date(existing.endTime) < new Date()) {
    res.status(400).json({ error: "Cannot edit a completed event." });
    return;
  }

  const [event] = await db.update(eventsTable).set(parsed.data).where(eq(eventsTable.id, eventId)).returning();
  if (!event) { res.status(404).json({ error: "Not found" }); return; }
  await audit(req.user!.id, "UPDATE_EVENT", "events", event.id);
  res.json(event);
});

// DELETE /events/:id
router.delete("/events/:id", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  
  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "completed" || new Date(existing.endTime) < new Date()) {
    res.status(400).json({ error: "Cannot delete a completed event." });
    return;
  }

  await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
  await audit(req.user!.id, "DELETE_EVENT", "events", eventId);
  res.status(204).send();
});

// GET /events/:id/deduction-rules
router.get("/events/:id/deduction-rules", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const rules = await db.select().from(deductionRulesTable).where(eq(deductionRulesTable.eventId, eventId));
  res.json(rules);
});

// POST /events/:id/deduction-rules
router.post("/events/:id/deduction-rules", requireAdmin, async (req, res) => {
  const parsed = CreateDeductionRuleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const eventId = parseInt(req.params.id as string, 10);
  const [rule] = await db.insert(deductionRulesTable).values({ ...parsed.data, eventId }).returning();
  res.status(201).json(rule);
});

// DELETE /events/:id/deduction-rules/:ruleId
router.delete("/events/:id/deduction-rules/:ruleId", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const ruleId = parseInt(req.params.ruleId as string, 10);
  await db.delete(deductionRulesTable).where(and(eq(deductionRulesTable.id, ruleId), eq(deductionRulesTable.eventId, eventId)));
  res.status(204).send();
});

// GET /events/:id/holder-link
router.get("/events/:id/holder-link", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const [link] = await db.select().from(eventHolderLinksTable).where(eq(eventHolderLinksTable.eventId, eventId));
  if (!link) { res.status(404).json({ error: "Not found" }); return; }
  res.json(link);
});

// POST /events/:id/holder-link
router.post("/events/:id/holder-link", requireAdmin, async (req, res) => {
  const token = randomBytes(24).toString("hex");
  const eventId = parseInt(req.params.id as string, 10);
  const existing = await db.select().from(eventHolderLinksTable).where(eq(eventHolderLinksTable.eventId, eventId));
  if (existing.length) {
    const [link] = await db.update(eventHolderLinksTable).set({ uniqueToken: token }).where(eq(eventHolderLinksTable.id, existing[0].id)).returning();
    res.status(201).json(link);
  } else {
    const [link] = await db.insert(eventHolderLinksTable).values({ eventId, uniqueToken: token }).returning();
    res.status(201).json(link);
  }
});

// GET /events/holder/:token (public)
router.get("/events/holder/:token", async (req, res) => {
  const token = req.params.token as string;
  const [link] = await db.select().from(eventHolderLinksTable).where(eq(eventHolderLinksTable.uniqueToken, token));
  if (!link) { res.status(404).json({ error: "Not found" }); return; }
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, link.eventId));
  const assignments = await db.select({ id: ushersTable.id, fullName: ushersTable.fullName, profilePhotoUrl: ushersTable.profilePhotoUrl }).from(eventAssignmentsTable).innerJoin(ushersTable, eq(eventAssignmentsTable.usherId, ushersTable.id)).where(and(eq(eventAssignmentsTable.eventId, link.eventId), eq(eventAssignmentsTable.status, "checked_in")));
  res.json({ event: { title: event.title, startTime: event.startTime, endTime: event.endTime }, ushers: assignments });
});

// GET /events/:id/assignments
router.get("/events/:id/assignments", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const assignments = await db.select({ id: eventAssignmentsTable.id, eventId: eventAssignmentsTable.eventId, usherId: eventAssignmentsTable.usherId, status: eventAssignmentsTable.status, isTeamLead: eventAssignmentsTable.isTeamLead, checkinTime: eventAssignmentsTable.checkinTime, checkinLat: eventAssignmentsTable.checkinLat, checkinLng: eventAssignmentsTable.checkinLng, checkinMethod: eventAssignmentsTable.checkinMethod, checkoutTime: eventAssignmentsTable.checkoutTime, checkoutLat: eventAssignmentsTable.checkoutLat, checkoutLng: eventAssignmentsTable.checkoutLng, usher: { id: ushersTable.id, fullName: ushersTable.fullName, email: ushersTable.email, phone: ushersTable.phone, status: ushersTable.status, avgRating: ushersTable.avgRating, balance: ushersTable.balance, nationalIdNumber: ushersTable.nationalIdNumber, nationalIdDocUrl: ushersTable.nationalIdDocUrl, profilePhotoUrl: ushersTable.profilePhotoUrl, createdAt: ushersTable.createdAt } }).from(eventAssignmentsTable).leftJoin(ushersTable, eq(eventAssignmentsTable.usherId, ushersTable.id)).where(eq(eventAssignmentsTable.eventId, eventId));
  res.json(assignments);
});

// POST /events/:id/assignments
router.post("/events/:id/assignments", requireAdmin, async (req, res) => {
  const parsed = AssignUsherToEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const eventId = parseInt(req.params.id as string, 10);

  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "completed" || new Date(existing.endTime) < new Date()) {
    res.status(400).json({ error: "Cannot assign ushers to a completed event." });
    return;
  }

  const [assignment] = await db.insert(eventAssignmentsTable).values({ eventId, usherId: parsed.data.usherId, isTeamLead: parsed.data.isTeamLead ?? false, status: "assigned" }).returning();
  await audit(req.user!.id, "ASSIGN_USHER", "event_assignments", assignment.id);
  res.status(201).json(assignment);
});

// DELETE /events/:id/assignments/:assignmentId
router.delete("/events/:id/assignments/:assignmentId", requireAdmin, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  await db.delete(eventAssignmentsTable).where(eq(eventAssignmentsTable.id, assignmentId));
  await audit(req.user!.id, "REMOVE_ASSIGNMENT", "event_assignments", assignmentId);
  res.status(204).send();
});

// POST /events/:id/assignments/:assignmentId/checkin - admin manual
router.post("/events/:id/assignments/:assignmentId/checkin", requireAdmin, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  const [assignment] = await db.update(eventAssignmentsTable).set({ checkinTime: new Date(), checkinMethod: "admin", status: "checked_in" }).where(eq(eventAssignmentsTable.id, assignmentId)).returning();
  await audit(req.user!.id, "ADMIN_CHECKIN", "event_assignments", assignment.id);
  res.json(assignment);
});

// POST /events/:id/assignments/:assignmentId/checkout - admin manual
router.post("/events/:id/assignments/:assignmentId/checkout", requireAdmin, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  const [assignment] = await db.update(eventAssignmentsTable).set({ checkoutTime: new Date(), status: "completed" }).where(eq(eventAssignmentsTable.id, assignmentId)).returning();
  await audit(req.user!.id, "ADMIN_CHECKOUT", "event_assignments", assignment.id);
  res.json(assignment);
});

// GET /events/:id/smart-candidates
router.get("/events/:id/smart-candidates", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const event = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event.length) { res.status(404).json({ error: "Not found" }); return; }
  const ushers = await db.select().from(ushersTable).where(eq(ushersTable.status, "active")).orderBy(desc(ushersTable.avgRating)).limit(20);
  const candidates = ushers.map(u => ({ id: u.id, fullName: u.fullName, avgRating: u.avgRating ?? 0, profilePhotoUrl: u.profilePhotoUrl, phone: u.phone, status: u.status ?? "active", isAvailable: true, matchScore: (u.avgRating ?? 0) / 5 }));
  res.json(candidates);
});

// GET /events/:id/waitlist
router.get("/events/:id/waitlist", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const entries = await db.select({ id: waitlistTable.id, eventId: waitlistTable.eventId, usherId: waitlistTable.usherId, priorityOrder: waitlistTable.priorityOrder, usher: { id: ushersTable.id, fullName: ushersTable.fullName, email: ushersTable.email, phone: ushersTable.phone, status: ushersTable.status, avgRating: ushersTable.avgRating, balance: ushersTable.balance, nationalIdNumber: ushersTable.nationalIdNumber, nationalIdDocUrl: ushersTable.nationalIdDocUrl, profilePhotoUrl: ushersTable.profilePhotoUrl, createdAt: ushersTable.createdAt } }).from(waitlistTable).leftJoin(ushersTable, eq(waitlistTable.usherId, ushersTable.id)).where(eq(waitlistTable.eventId, eventId));
  res.json(entries);
});

// POST /events/:id/waitlist
router.post("/events/:id/waitlist", requireAdmin, async (req, res) => {
  const { usherId, priorityOrder } = req.body;
  const eventId = parseInt(req.params.id as string, 10);

  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "completed" || new Date(existing.endTime) < new Date()) {
    res.status(400).json({ error: "Cannot add to waitlist of a completed event." });
    return;
  }

  const [entry] = await db.insert(waitlistTable).values({ eventId, usherId, priorityOrder }).returning();
  res.status(201).json(entry);
});

export default router;
