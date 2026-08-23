import { Router } from "express";
import { randomBytes } from "crypto";
import { db, eventsTable, eventAssignmentsTable, deductionRulesTable, eventHolderLinksTable, waitlistTable, ushersTable, usherAvailabilityTable, eventTeamsTable } from "@workspace/db";
import { eq, and, gte, sql, desc, lt, gt, ne, inArray, lte } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";
import { sseManager } from "../lib/sse.js";

import {
  CreateEventBody,
  UpdateEventBody,
  CreateDeductionRuleBody,
  AssignUsherToEventBody,
  CreateEventTeamBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { sendPushToUsher, sendPushToUshers } from "../lib/fcm.js";

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) +
          Math.cos(p1) * Math.cos(p2) *
          Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const router = Router();

function buildEventDetail(event: any, assignments: any[], deductionRules: any[]) {
  return { ...event, assignments, deductionRules };
}

// GET /events
router.get("/events", requireAuth, async (req, res) => {
  // Auto-completion logic moved to the background cron job to prevent slow page loads

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
  // Auto-completion logic moved to the background cron job to prevent slow page loads

  const eventId = parseInt(req.params.id as string, 10);
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event) { res.status(404).json({ error: "Not found" }); return; }

  if (req.user!.type === "usher") {
    const [isAssigned] = await db.select().from(eventAssignmentsTable).where(
      and(eq(eventAssignmentsTable.eventId, event.id), eq(eventAssignmentsTable.usherId, req.user!.id))
    );
    const [isWaitlisted] = await db.select().from(waitlistTable).where(
      and(eq(waitlistTable.eventId, event.id), eq(waitlistTable.usherId, req.user!.id))
    );
    if (!isAssigned && !isWaitlisted) {
      res.status(403).json({ error: "You are not assigned or waitlisted to this event." });
      return;
    }
  }

  const assignments = await db.select({ id: eventAssignmentsTable.id, eventId: eventAssignmentsTable.eventId, eventTeamId: eventAssignmentsTable.eventTeamId, usherId: eventAssignmentsTable.usherId, status: eventAssignmentsTable.status, isTeamLead: eventAssignmentsTable.isTeamLead, checkinTime: eventAssignmentsTable.checkinTime, checkinLat: eventAssignmentsTable.checkinLat, checkinLng: eventAssignmentsTable.checkinLng, checkinMethod: eventAssignmentsTable.checkinMethod, checkoutTime: eventAssignmentsTable.checkoutTime, checkoutLat: eventAssignmentsTable.checkoutLat, checkoutLng: eventAssignmentsTable.checkoutLng, usher: { id: ushersTable.id, fullName: ushersTable.fullName, email: ushersTable.email, phone: ushersTable.phone, status: ushersTable.status, avgRating: ushersTable.avgRating, balance: ushersTable.balance, nationalIdNumber: ushersTable.nationalIdNumber, nationalIdDocUrl: ushersTable.nationalIdDocUrl, profilePhotoUrl: ushersTable.profilePhotoUrl, createdAt: ushersTable.createdAt } }).from(eventAssignmentsTable).leftJoin(ushersTable, eq(eventAssignmentsTable.usherId, ushersTable.id)).where(eq(eventAssignmentsTable.eventId, event.id));
  const deductionRules = await db.select().from(deductionRulesTable).where(eq(deductionRulesTable.eventId, event.id));
  res.json(buildEventDetail(event, assignments, deductionRules));
});

// PATCH /events/:id
router.patch("/events/:id", requireAdmin, async (req, res) => {
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const eventId = parseInt(req.params.id as string, 10);
  
  try {
    const event = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(eventsTable).where(eq(eventsTable.id, eventId));
      if (!existing) throw new Error("Not found");
      if (existing.status === "completed" || new Date(existing.endTime) < new Date()) {
        throw new Error("Cannot edit a completed event.");
      }
      // Check version if provided
      if (parsed.data.version !== undefined && existing.version !== parsed.data.version) {
        throw new Error("Conflict");
      }
      
      const newVersion = existing.version + 1;
      const [updated] = await tx.update(eventsTable)
        .set({ ...parsed.data, version: newVersion })
        .where(and(eq(eventsTable.id, eventId), eq(eventsTable.version, existing.version)))
        .returning();
      
      if (!updated) throw new Error("Conflict"); // If version changed between select and update
      await audit(req.user!.id, "UPDATE_EVENT", "events", updated.id);
      return updated;
    });
    
    sseManager.broadcast("EVENT_UPDATED", { id: event.id });
    res.json(event);
  } catch (err: any) {
    if (err.message === "Not found") res.status(404).json({ error: "Not found" });
    else if (err.message === "Conflict") res.status(409).json({ error: "This record was just changed by someone else, please refresh" });
    else res.status(400).json({ error: err.message });
  }
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

// GET /events/:id/teams
router.get("/events/:id/teams", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const teams = await db.select().from(eventTeamsTable).where(eq(eventTeamsTable.eventId, eventId));
  res.json(teams);
});

// POST /events/:id/teams
router.post("/events/:id/teams", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const parsed = CreateEventTeamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [team] = await db.insert(eventTeamsTable).values({ eventId, name: parsed.data.name }).returning();
  await audit(req.user!.id, "CREATE_TEAM", "event_teams", team.id);
  res.status(201).json(team);
});

// DELETE /events/:id/teams/:teamId
router.delete("/events/:id/teams/:teamId", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const teamId = parseInt(req.params.teamId as string, 10);
  await db.delete(eventTeamsTable).where(and(eq(eventTeamsTable.id, teamId), eq(eventTeamsTable.eventId, eventId)));
  await audit(req.user!.id, "DELETE_TEAM", "event_teams", teamId);
  res.status(204).send();
});

// GET /events/:id/teams/:teamId/leader-suggestions
router.get("/events/:id/teams/:teamId/leader-suggestions", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const teamId = parseInt(req.params.teamId as string, 10);
  
  // Get all ushers assigned to this team
  const assignments = await db.select({
    usher: ushersTable
  }).from(eventAssignmentsTable)
    .innerJoin(ushersTable, eq(eventAssignmentsTable.usherId, ushersTable.id))
    .where(eq(eventAssignmentsTable.eventTeamId, teamId));

  if (!assignments.length) {
    res.json([]);
    return;
  }

  const usherIds = assignments.map(a => a.usher.id);

  // Get historical data for these ushers to compute score
  // We want to count completed events and average late arrival minutes
  const history = await db.select({
    usherId: eventAssignmentsTable.usherId,
    completedEvents: sql<number>`count(id)::int`,
    avgLateMins: sql<number>`avg(late_arrival_minutes)::float`
  }).from(eventAssignmentsTable)
    .where(and(
      inArray(eventAssignmentsTable.usherId, usherIds),
      eq(eventAssignmentsTable.status, "completed")
    ))
    .groupBy(eventAssignmentsTable.usherId);

  const historyMap = new Map(history.map(h => [h.usherId, h]));

  const candidates = assignments.map(a => {
    const u = a.usher;
    const h = historyMap.get(u.id) || { completedEvents: 0, avgLateMins: 0 };
    
    // Normalize metrics
    // Let's say max rating is 5, max completed events expected is 20 (cap at 1), max late minutes is 60 (invert)
    const ratingScore = (u.avgRating || 0) / 5;
    const experienceScore = Math.min(h.completedEvents, 20) / 20;
    const punctualityScore = Math.max(0, 60 - h.avgLateMins) / 60;

    // Weight: 50% rating, 30% experience, 20% punctuality
    const matchScore = (ratingScore * 0.5) + (experienceScore * 0.3) + (punctualityScore * 0.2);

    return {
      id: u.id,
      fullName: u.fullName,
      avgRating: u.avgRating || 0,
      profilePhotoUrl: u.profilePhotoUrl,
      phone: u.phone,
      status: u.status || "active",
      isAvailable: true, // They are already assigned to the event
      matchScore
    };
  });

  candidates.sort((a, b) => b.matchScore - a.matchScore);
  res.json(candidates);
});

// GET /events/:id/assignments
router.get("/events/:id/assignments", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const assignments = await db.select({ id: eventAssignmentsTable.id, eventId: eventAssignmentsTable.eventId, eventTeamId: eventAssignmentsTable.eventTeamId, usherId: eventAssignmentsTable.usherId, status: eventAssignmentsTable.status, isTeamLead: eventAssignmentsTable.isTeamLead, checkinTime: eventAssignmentsTable.checkinTime, checkinLat: eventAssignmentsTable.checkinLat, checkinLng: eventAssignmentsTable.checkinLng, checkinMethod: eventAssignmentsTable.checkinMethod, checkoutTime: eventAssignmentsTable.checkoutTime, checkoutLat: eventAssignmentsTable.checkoutLat, checkoutLng: eventAssignmentsTable.checkoutLng, usher: { id: ushersTable.id, fullName: ushersTable.fullName, email: ushersTable.email, phone: ushersTable.phone, status: ushersTable.status, avgRating: ushersTable.avgRating, balance: ushersTable.balance, nationalIdNumber: ushersTable.nationalIdNumber, nationalIdDocUrl: ushersTable.nationalIdDocUrl, profilePhotoUrl: ushersTable.profilePhotoUrl, createdAt: ushersTable.createdAt } }).from(eventAssignmentsTable).leftJoin(ushersTable, eq(eventAssignmentsTable.usherId, ushersTable.id)).where(eq(eventAssignmentsTable.eventId, eventId));
  res.json(assignments);
});

// POST /events/:id/assignments
router.post("/events/:id/assignments", requireAdmin, async (req, res) => {
  const parsed = AssignUsherToEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const eventId = parseInt(req.params.id as string, 10);

  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "completed" || new Date(existing.endTime) <= new Date() || new Date(existing.startTime) <= new Date()) {
    res.status(400).json({ error: "Cannot assign ushers after the event has started." });
    return;
  }

  // Check for overlaps with other events
  const overlappingAssignments = await db.select()
    .from(eventAssignmentsTable)
    .innerJoin(eventsTable, eq(eventAssignmentsTable.eventId, eventsTable.id))
    .where(
      and(
        eq(eventAssignmentsTable.usherId, parsed.data.usherId),
        inArray(eventAssignmentsTable.status, ["assigned", "accepted", "checked_in"]),
        lt(eventsTable.startTime, existing.endTime),
        gt(eventsTable.endTime, existing.startTime)
      )
    );

  if (overlappingAssignments.length > 0) {
    res.status(400).json({ error: "Cannot assign usher because they are busy with another event during this time." });
    return;
  }

  try {
    const [assignment] = await db.insert(eventAssignmentsTable).values({ eventId, usherId: parsed.data.usherId, eventTeamId: parsed.data.eventTeamId, isTeamLead: parsed.data.isTeamLead ?? false, status: "assigned" }).returning();
    await audit(req.user!.id, "ASSIGN_USHER", "event_assignments", assignment.id);

    // Send push notification to the assigned usher
    await sendPushToUsher(parsed.data.usherId, {
      title: "You are Assigned 🎉",
      body: `You have been assigned to the event "${existing.title}". Check event details.`,
      data: { eventId: String(eventId), type: "assignment" },
    });

    sseManager.broadcast("ASSIGNMENT_CREATED", { id: assignment.id, eventId });
    res.status(201).json(assignment);
  } catch (err: any) {
    if (err.code === "23505") { // unique violation
      res.status(409).json({ error: "This usher is already assigned to this event." });
    } else {
      res.status(500).json({ error: "Failed to assign usher." });
    }
  }
});

// PATCH /events/:id/assignments/:assignmentId
router.patch("/events/:id/assignments/:assignmentId", requireAdmin, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  const eventId = parseInt(req.params.id as string, 10);

  const [existingEvent] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!existingEvent) { res.status(404).json({ error: "Not found" }); return; }

  const parsed = AssignUsherToEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  // If making someone a team lead, optionally demote others in the same team
  if (parsed.data.isTeamLead && parsed.data.eventTeamId) {
    await db.update(eventAssignmentsTable)
      .set({ isTeamLead: false })
      .where(eq(eventAssignmentsTable.eventTeamId, parsed.data.eventTeamId));
  }

  const [assignment] = await db.update(eventAssignmentsTable)
    .set({
      eventTeamId: parsed.data.eventTeamId,
      isTeamLead: parsed.data.isTeamLead ?? false
    })
    .where(eq(eventAssignmentsTable.id, assignmentId))
    .returning();

  if (!assignment) { res.status(404).json({ error: "Assignment not found" }); return; }
  await audit(req.user!.id, "UPDATE_ASSIGNMENT", "event_assignments", assignmentId);
  res.json(assignment);
});

// DELETE /events/:id/assignments/:assignmentId
router.delete("/events/:id/assignments/:assignmentId", requireAdmin, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  const eventId = parseInt(req.params.id as string, 10);

  const [existingEvent] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!existingEvent) { res.status(404).json({ error: "Not found" }); return; }
  if (existingEvent.status === "completed" || new Date(existingEvent.endTime) <= new Date() || new Date(existingEvent.startTime) <= new Date()) {
    res.status(400).json({ error: "Cannot remove assignments after the event has started." });
    return;
  }

  const [assignment] = await db.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.id, assignmentId));
  if (assignment && assignment.status !== "assigned" && assignment.status !== "accepted") {
    res.status(400).json({ error: "Cannot remove an usher who has already checked in or cancelled." });
    return;
  }

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

const smartAssignSchema = z.object({
  count: z.number().int().positive(),
  eventTeamId: z.number().int().optional(),
  gender: z.enum(["male", "female"]).optional(),
  minRating: z.number().optional(),
  minCompletedEvents: z.number().int().optional(),
  requiresLeadershipExp: z.boolean().optional(),
  maxDistanceMeters: z.number().optional(),
});

// POST /events/:id/smart-assign-batch
router.post("/events/:id/smart-assign-batch", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const parsed = smartAssignSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  
  const filters = parsed.data;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event) { res.status(404).json({ error: "Not found" }); return; }
  if (event.status === "completed" || new Date(event.endTime) <= new Date() || new Date(event.startTime) <= new Date()) {
    res.status(400).json({ error: "Cannot assign ushers after the event has started." });
    return;
  }

  // Find assigned ushers
  const assignments = await db.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.eventId, eventId));
  const assignedUsherIds = new Set(assignments.map(a => a.usherId));

  // Find busy ushers
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);
  const eventStartStr = eventStart.toISOString().split("T")[0];
  const eventEndStr = eventEnd.toISOString().split("T")[0];
  const unavailabilities = await db.select().from(usherAvailabilityTable)
    .where(and(gte(usherAvailabilityTable.date, eventStartStr), lte(usherAvailabilityTable.date, eventEndStr)));
  const busyUsherIds = new Set<number>();
  for (const av of unavailabilities) {
    const busyStart = new Date(`${av.date}T${av.startTime}`);
    const busyEnd = new Date(`${av.date}T${av.endTime}`);
    if (busyStart < eventEnd && busyEnd > eventStart) {
      busyUsherIds.add(av.usherId);
    }
  }

  // Also find ushers busy with other overlapping events
  const overlappingAssignments = await db.select({ usherId: eventAssignmentsTable.usherId })
    .from(eventAssignmentsTable)
    .innerJoin(eventsTable, eq(eventAssignmentsTable.eventId, eventsTable.id))
    .where(
      and(
        inArray(eventAssignmentsTable.status, ["assigned", "accepted", "checked_in"]),
        lt(eventsTable.startTime, eventEnd),
        gt(eventsTable.endTime, eventStart),
        ne(eventsTable.id, eventId)
      )
    );
    
  for (const oa of overlappingAssignments) {
    busyUsherIds.add(oa.usherId);
  }

  // Get all ushers
  let ushers = await db.select().from(ushersTable);

  // Apply simple filters
  ushers = ushers.filter(u => {
    if (assignedUsherIds.has(u.id)) return false;
    if (busyUsherIds.has(u.id)) return false;
    if (filters.gender && u.gender !== filters.gender) return false;
    if (filters.minRating && (u.avgRating || 0) < filters.minRating) return false;
    
    if (filters.maxDistanceMeters) {
      if (!u.homeLat || !u.homeLng || !event.venueLat || !event.venueLng) return false;
      const dist = getDistanceMeters(u.homeLat, u.homeLng, event.venueLat, event.venueLng);
      if (dist > filters.maxDistanceMeters) return false;
    }
    return true;
  });

  // If requires experience filters
  if ((filters.minCompletedEvents && filters.minCompletedEvents > 0) || filters.requiresLeadershipExp) {
    if (ushers.length > 0) {
      const history = await db.select({
        usherId: eventAssignmentsTable.usherId,
        completedEvents: sql<number>`count(id)::int`,
        leadEvents: sql<number>`sum(case when is_team_lead then 1 else 0 end)::int`
      }).from(eventAssignmentsTable)
        .where(and(
          inArray(eventAssignmentsTable.usherId, ushers.map(u => u.id)),
          eq(eventAssignmentsTable.status, "completed")
        ))
        .groupBy(eventAssignmentsTable.usherId);
      
      const historyMap = new Map(history.map(h => [h.usherId, h]));

      ushers = ushers.filter(u => {
        const h = historyMap.get(u.id) || { completedEvents: 0, leadEvents: 0 };
        if (filters.minCompletedEvents && h.completedEvents < filters.minCompletedEvents) return false;
        if (filters.requiresLeadershipExp && h.leadEvents === 0) return false;
        return true;
      });
    }
  }

  // Rank remaining
  ushers.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));

  const selected = ushers.slice(0, filters.count);

  if (selected.length === 0) {
    res.status(201).json([]);
    return;
  }

  const inserts = selected.map(u => ({
    eventId,
    usherId: u.id,
    eventTeamId: filters.eventTeamId,
    status: "assigned" as const
  }));

  const created = await db.insert(eventAssignmentsTable).values(inserts).returning();
  
  for (const c of created) {
    await audit(req.user!.id, "ASSIGN_USHER", "event_assignments", c.id);
  }

  // Send push notifications to all newly assigned ushers
  const [targetEvent] = await db.select({ title: eventsTable.title }).from(eventsTable).where(eq(eventsTable.id, eventId));
  if (targetEvent) {
    await sendPushToUshers(created.map(c => c.usherId), {
      title: "You are Assigned 🎉",
      body: `You have been assigned to the event "${targetEvent.title}". Check event details.`,
      data: { eventId: String(eventId), type: "assignment" },
    });
  }

  res.status(201).json(created);
});

// GET /events/:id/smart-candidates
router.get("/events/:id/smart-candidates", requireAdmin, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id as string, 10);
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
    if (!event) { res.status(404).json({ error: "Not found" }); return; }
    
    // Fetch up to 100 ushers
    const activeUshers = await db.select().from(ushersTable).orderBy(desc(ushersTable.avgRating)).limit(100);
    
    // Fetch currently assigned ushers to exclude them
    const currentAssignments = await db.select({ usherId: eventAssignmentsTable.usherId }).from(eventAssignmentsTable).where(eq(eventAssignmentsTable.eventId, eventId));
    const assignedUsherIds = new Set(currentAssignments.map(a => a.usherId));
    
    // Get up to 20 unassigned ushers
    const ushers = activeUshers.filter(u => !assignedUsherIds.has(u.id)).slice(0, 20);
    
    if (ushers.length === 0) {
      res.json([{ id: 9998, fullName: `DEBUG: Ushers array is empty (active: ${activeUshers.length}, assigned: ${assignedUsherIds.size})`, isAvailable: true, avgRating: 0 }]);
      return;
    }

    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    const eventStartStr = eventStart.toISOString().split("T")[0];
    const eventEndStr = eventEnd.toISOString().split("T")[0];

    const unavailabilities = await db.select().from(usherAvailabilityTable)
      .where(
        and(
          inArray(usherAvailabilityTable.usherId, ushers.map(u => u.id)),
          gte(usherAvailabilityTable.date, eventStartStr),
          lte(usherAvailabilityTable.date, eventEndStr)
        )
      );

    const overlappingAssignments = await db.select({ usherId: eventAssignmentsTable.usherId })
      .from(eventAssignmentsTable)
      .innerJoin(eventsTable, eq(eventAssignmentsTable.eventId, eventsTable.id))
      .where(
        and(
          inArray(eventAssignmentsTable.status, ["assigned", "accepted", "checked_in"]),
          lt(eventsTable.startTime, event.endTime),
          gt(eventsTable.endTime, event.startTime),
          ne(eventsTable.id, eventId) // Exclude current event
        )
      );

    const candidates = ushers.map(u => {
      let isAvailable = true;
      const usherUnavail = unavailabilities.filter(av => av.usherId === u.id);
      for (const av of usherUnavail) {
        const busyStart = new Date(`${av.date}T${av.startTime}`);
        const busyEnd = new Date(`${av.date}T${av.endTime}`);
        if (busyStart < eventEnd && busyEnd > eventStart) {
          isAvailable = false;
          break;
        }
      }

    if (isAvailable && overlappingAssignments.some(oa => oa.usherId === u.id)) {
      isAvailable = false;
    }

    return { 
      id: u.id, 
      fullName: u.fullName, 
      avgRating: u.avgRating ?? 0, 
      profilePhotoUrl: u.profilePhotoUrl, 
      phone: u.phone, 
      status: u.status ?? "active", 
      isAvailable, 
      matchScore: (u.avgRating ?? 0) / 5 
    };
  });

  res.json(candidates);
  } catch (error: any) {
    console.error("Error in smart-candidates:", error);
    res.json([{ id: 9999, fullName: `ERROR: ${error.message}`, isAvailable: true, avgRating: 0 }]);
  }
});

// GET /events/:id/waitlist
router.get("/events/:id/waitlist", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const entries = await db.select({ id: waitlistTable.id, eventId: waitlistTable.eventId, usherId: waitlistTable.usherId, priorityOrder: waitlistTable.priorityOrder, status: waitlistTable.status, usher: { id: ushersTable.id, fullName: ushersTable.fullName, email: ushersTable.email, phone: ushersTable.phone, status: ushersTable.status, avgRating: ushersTable.avgRating, balance: ushersTable.balance, nationalIdNumber: ushersTable.nationalIdNumber, nationalIdDocUrl: ushersTable.nationalIdDocUrl, profilePhotoUrl: ushersTable.profilePhotoUrl, createdAt: ushersTable.createdAt } }).from(waitlistTable).leftJoin(ushersTable, eq(waitlistTable.usherId, ushersTable.id)).where(eq(waitlistTable.eventId, eventId));
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

// DELETE /events/:id/waitlist/:waitlistId
router.delete("/events/:id/waitlist/:waitlistId", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const waitlistId = parseInt(req.params.waitlistId as string, 10);

  const [existing] = await db.select().from(waitlistTable).where(and(eq(waitlistTable.id, waitlistId), eq(waitlistTable.eventId, eventId)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(waitlistTable).where(eq(waitlistTable.id, waitlistId));
  res.json({ success: true });
});

// POST /events/:id/waitlist/:waitlistId/promote
router.post("/events/:id/waitlist/:waitlistId/promote", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const waitlistId = parseInt(req.params.waitlistId as string, 10);
  const { eventTeamId, isTeamLead } = req.body;

  const [existing] = await db.select().from(waitlistTable).where(and(eq(waitlistTable.id, waitlistId), eq(waitlistTable.eventId, eventId)));
  if (!existing) { res.status(404).json({ error: "Waitlist entry not found" }); return; }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const [usher] = await db.select().from(ushersTable).where(eq(ushersTable.id, existing.usherId));

  // Check for overlaps with other events
  const overlappingAssignments = await db.select()
    .from(eventAssignmentsTable)
    .innerJoin(eventsTable, eq(eventAssignmentsTable.eventId, eventsTable.id))
    .where(
      and(
        eq(eventAssignmentsTable.usherId, existing.usherId),
        inArray(eventAssignmentsTable.status, ["assigned", "accepted", "checked_in"]),
        lt(eventsTable.startTime, event.endTime),
        gt(eventsTable.endTime, event.startTime)
      )
    );

  if (overlappingAssignments.length > 0) {
    res.status(400).json({ error: "Cannot promote usher because they are busy with another event during this time." });
    return;
  }

  // Remove from waitlist
  await db.delete(waitlistTable).where(eq(waitlistTable.id, waitlistId));

  // Add to assignments
  const [assignment] = await db.insert(eventAssignmentsTable).values({
    eventId,
    usherId: existing.usherId,
    eventTeamId: eventTeamId || null,
    isTeamLead: isTeamLead || false,
    status: existing.status === "accepted" ? "accepted" : "assigned"
  }).returning();

  // Send push notification to the promoted usher
  const [promotedEvent] = await db.select({ title: eventsTable.title }).from(eventsTable).where(eq(eventsTable.id, eventId));
  if (promotedEvent) {
    await sendPushToUsher(existing.usherId, {
      title: "Waitlist Promoted 🎉",
      body: `You have been promoted for the event "${promotedEvent.title}". Check event details.`,
      data: { eventId: String(eventId), type: "assignment" },
    });
  }

  res.json({ ...assignment, usher });
});

export default router;
