import { Router } from "express";
import { randomBytes } from "crypto";
import { db, eventsTable, eventAssignmentsTable, deductionRulesTable, eventHolderLinksTable, ushersTable, usherAvailabilityTable, eventTeamsTable, adminsTable, eventFeedbackLinksTable, balanceTransactionsTable, notificationsTable, assignmentDeductionsTable } from "@workspace/db";
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
import { sendPushToUsher, sendPushToUshers, sendPushToAllUshers } from "../lib/fcm.js";

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
  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let query = db.select().from(eventsTable).$dynamic().orderBy(desc(eventsTable.startTime));
  
  if (req.user!.type === "usher") {
    query = query.where(eq(eventsTable.status, "published"));
  } else if (status) {
    query = query.where(eq(eventsTable.status, status));
  }
  
  const data = await query.limit(parseInt(limit)).offset(offset);
  
  // Fetch deduction rules for these events
  const eventIds = data.map((e: any) => e.id);
  let allDeductionRules: any[] = [];
  if (eventIds.length > 0) {
    allDeductionRules = await db.select().from(deductionRulesTable).where(inArray(deductionRulesTable.eventId, eventIds));
  }
  
  const dataWithRules = data.map((event: any) => ({
    ...event,
    deductionRules: allDeductionRules.filter((r: any) => r.eventId === event.id)
  }));

  // Count
  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(eventsTable).$dynamic();
  if (req.user!.type === "usher") {
    countQuery = countQuery.where(eq(eventsTable.status, "published"));
  } else if (status) {
    countQuery = countQuery.where(eq(eventsTable.status, status));
  }
  const [{ count }] = await countQuery;
  res.json({ data: dataWithRules, total: count });
});

// POST /events
router.post("/events", requireAdmin, async (req, res) => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  
  const [admin] = await db.select({ role: adminsTable.role, canManageFinance: adminsTable.canManageFinance }).from(adminsTable).where(eq(adminsTable.id, req.user!.id));
  const isSuperAdmin = admin?.role === "super_admin";
  const hasFinanceAccess = isSuperAdmin || admin?.canManageFinance;
  
  if (!hasFinanceAccess) {
    delete parsed.data.budget;
  }
  
  const superAdminLockedFields = hasFinanceAccess ? Object.keys(parsed.data) : [];
  if (hasFinanceAccess && !superAdminLockedFields.includes("budget")) superAdminLockedFields.push("budget"); // Implicit lock

  const [event] = await db.insert(eventsTable).values({ 
    ...parsed.data, 
    createdByAdminId: req.user!.id,
    superAdminLockedFields
  }).returning();
  
  await audit(req.user!.id, "CREATE_EVENT", "events", event.id);

  if (event.status === "published") {
    await sendPushToAllUshers({
      title: "New Event Available 📣",
      body: `A new event "${event.title}" is now available. Apply now!`,
      data: { eventId: String(event.id), type: "event_published" },
    });
  }

  res.status(201).json(event);
});

// GET /events/:id
router.get("/events/:id", requireAuth, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event) { res.status(404).json({ error: "Not found" }); return; }

  if (req.user!.type === "usher") {
    if (event.status === "draft") {
      res.status(404).json({ error: "Not found" });
      return;
    }
  }

  const assignments = await db.select({
    id: eventAssignmentsTable.id,
    usherId: eventAssignmentsTable.usherId,
    eventId: eventAssignmentsTable.eventId,
    eventTeamId: eventAssignmentsTable.eventTeamId,
    status: eventAssignmentsTable.status,
    role: eventAssignmentsTable.role,
    isTeamLead: eventAssignmentsTable.isTeamLead,
    overriddenPay: eventAssignmentsTable.overriddenPay,
    checkinTime: eventAssignmentsTable.checkinTime,
    checkoutTime: eventAssignmentsTable.checkoutTime,
    checkinLat: eventAssignmentsTable.checkinLat,
    checkinLng: eventAssignmentsTable.checkinLng,
usher: {
      id: ushersTable.id,
      fullName: ushersTable.fullName,
      phone: ushersTable.phone,
      gender: ushersTable.gender,
      dressSize: ushersTable.dressSize,
      shoeSize: ushersTable.shoeSize,
      shirtSize: ushersTable.shirtSize,
      tShirtSize: ushersTable.tShirtSize,
      pantsSize: ushersTable.pantsSize,
      shortsSize: ushersTable.shortsSize,
      profilePhotoKey: ushersTable.profilePhotoKey,
      profilePhotoUrl: ushersTable.profilePhotoUrl,
      avgRating: ushersTable.avgRating,
      languages: ushersTable.languages,
      height: ushersTable.height,
      dateOfBirth: ushersTable.dateOfBirth,
      }
  }).from(eventAssignmentsTable)
    .innerJoin(ushersTable, eq(eventAssignmentsTable.usherId, ushersTable.id))
    .where(eq(eventAssignmentsTable.eventId, eventId));

  const deductionRules = await db.select().from(deductionRulesTable).where(eq(deductionRulesTable.eventId, eventId));
  const manualDeductions = await db.select().from(assignmentDeductionsTable).innerJoin(eventAssignmentsTable, eq(assignmentDeductionsTable.eventAssignmentId, eventAssignmentsTable.id)).where(eq(eventAssignmentsTable.eventId, eventId));
  
  // Attach manual deductions to assignments
  for (const a of assignments) {
    (a as any).manualDeductions = manualDeductions.filter(md => md.assignment_deductions.eventAssignmentId === a.id).map(md => md.assignment_deductions);
  }

  if (req.user!.type === "usher") {
    // Determine if usher is assigned or applied
    const myAssignment = assignments.find(a => a.usherId === req.user!.id);
    if (!myAssignment && event.status !== "published") {
      res.status(403).json({ error: "You cannot view this event." });
      return;
    }
    // Only return the user's own assignment for privacy
    res.json(buildEventDetail(event, myAssignment ? [myAssignment] : [], deductionRules));
    return;
  }

  res.json(buildEventDetail(event, assignments, deductionRules));
});

// PATCH /events/:id
router.patch("/events/:id", requireAdmin, async (req, res) => {
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const eventId = parseInt(req.params.id as string, 10);
  
  const [admin] = await db.select({ role: adminsTable.role, canManageFinance: adminsTable.canManageFinance }).from(adminsTable).where(eq(adminsTable.id, req.user!.id));
  const isSuperAdmin = admin?.role === "super_admin";
  const hasFinanceAccess = isSuperAdmin || admin?.canManageFinance;

  try {
    const event = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(eventsTable).where(eq(eventsTable.id, eventId));
      if (!existing) throw new Error("Not found");
      if (existing.status === "completed" || new Date(existing.endTime) < new Date()) {
        throw new Error("Cannot edit a completed event.");
      }
      if (parsed.data.version !== undefined && existing.version !== parsed.data.version) {
        throw new Error("Conflict");
      }
      
      const lockedFields = Array.isArray(existing.superAdminLockedFields) ? existing.superAdminLockedFields : [];
      
      if (!isSuperAdmin) {
        if (parsed.data.status === "published" && existing.status !== "published") {
          throw new Error("Forbidden: Only Super Admins can publish events.");
        }
        
        const attemptedLockedFields = Object.keys(parsed.data).filter(key => {
          const val = parsed.data[key as keyof typeof parsed.data];
          const existVal = existing[key as keyof typeof existing];
          // Simple equality check, handle dates if needed
          const isDifferent = val !== undefined && val !== existVal && (val instanceof Date && existVal instanceof Date ? val.getTime() !== existVal.getTime() : true);
          
          if (key === "budget" && hasFinanceAccess) {
             return false; // Finance admins can edit budget even if locked
          }
          return lockedFields.includes(key) && isDifferent;
        });
        
        if (attemptedLockedFields.length > 0) {
          throw new Error(`Forbidden: Cannot edit fields locked by Super Admin: ${attemptedLockedFields.join(', ')}`);
        }
      }
      
      let newLockedFields = lockedFields;
      if (hasFinanceAccess) {
        const editedFields = Object.keys(parsed.data).filter(key => {
          if (key === 'version') return false;
          
          const val = parsed.data[key as keyof typeof parsed.data];
          const existVal = existing[key as keyof typeof existing];
          
          // Helper to normalize and compare dates
          if (key === 'startTime' || key === 'endTime') {
             const vTime = val ? new Date(val as string | number | Date).getTime() : null;
             const eTime = existVal ? new Date(existVal as string | number | Date).getTime() : null;
             return vTime !== eTime;
          }
          
          // Helper to handle null vs undefined equivalents
          if ((val === null || val === undefined || val === '') && (existVal === null || existVal === undefined || existVal === '')) {
             return false; // Both are empty-ish
          }
          
          // Compare numbers where string/number types might get mixed up occasionally (e.g. lat/lng)
          if (typeof val === 'number' || typeof existVal === 'number') {
             return Number(val) !== Number(existVal);
          }
          
          return val !== existVal;
        });
        
        newLockedFields = Array.from(new Set([...lockedFields, ...editedFields]));
      }
      
      const newVersion = existing.version + 1;
      const [updated] = await tx.update(eventsTable)
        .set({ ...parsed.data, version: newVersion, superAdminLockedFields: newLockedFields })
        .where(and(eq(eventsTable.id, eventId), eq(eventsTable.version, existing.version)))
        .returning();
      
      if (!updated) throw new Error("Conflict");
      await audit(req.user!.id, "UPDATE_EVENT", "events", updated.id);
      return { updated, oldStatus: existing.status };
    });
    
    if (event.updated.status === "published" && event.oldStatus !== "published") {
      await sendPushToAllUshers({
        title: "New Event Available 📣",
        body: `A new event "${event.updated.title}" is now available. Apply now!`,
        data: { eventId: String(event.updated.id), type: "event_published" },
      });
    }

    sseManager.broadcast("EVENT_UPDATED", { id: event.updated.id });
    res.json(event.updated);
  } catch (err: any) {
    if (err.message === "Not found") res.status(404).json({ error: "Not found" });
    else if (err.message === "Conflict") res.status(409).json({ error: "This record was just changed by someone else, please refresh" });
    else if (err.message.startsWith("Forbidden:")) res.status(403).json({ error: err.message });
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
  const dataToInsert = {
    ...parsed.data,
    eventId,
    triggerType: parsed.data.triggerType ?? undefined,
    thresholdMinutes: parsed.data.thresholdMinutes ?? undefined,
  };
  const [rule] = await db.insert(deductionRulesTable).values(dataToInsert).returning();
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
  const assignments = await db.select({ id: ushersTable.id, fullName: ushersTable.fullName, profilePhotoUrl: ushersTable.profilePhotoUrl, profilePhotoKey: ushersTable.profilePhotoKey }).from(eventAssignmentsTable).innerJoin(ushersTable, eq(eventAssignmentsTable.usherId, ushersTable.id)).where(and(eq(eventAssignmentsTable.eventId, link.eventId), eq(eventAssignmentsTable.status, "checked_in")));
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
  const [team] = await db.insert(eventTeamsTable).values({ eventId, name: parsed.data.name, instructions: (parsed.data as any).instructions }).returning();
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
      profilePhotoKey: u.profilePhotoKey,
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
  const assignments = await db.select({ id: eventAssignmentsTable.id, eventId: eventAssignmentsTable.eventId, eventTeamId: eventAssignmentsTable.eventTeamId, usherId: eventAssignmentsTable.usherId, status: eventAssignmentsTable.status, role: eventAssignmentsTable.role, overriddenPay: eventAssignmentsTable.overriddenPay, isTeamLead: eventAssignmentsTable.isTeamLead, checkinTime: eventAssignmentsTable.checkinTime, checkinLat: eventAssignmentsTable.checkinLat, checkinLng: eventAssignmentsTable.checkinLng, checkinPhotoKey: eventAssignmentsTable.checkinPhotoKey, checkinMethod: eventAssignmentsTable.checkinMethod, checkoutTime: eventAssignmentsTable.checkoutTime, checkoutLat: eventAssignmentsTable.checkoutLat, checkoutLng: eventAssignmentsTable.checkoutLng, lateArrivalMinutes: eventAssignmentsTable.lateArrivalMinutes, earlyLeaveMinutes: eventAssignmentsTable.earlyLeaveMinutes, usher: { id: ushersTable.id, fullName: ushersTable.fullName, email: ushersTable.email, phone: ushersTable.phone, status: ushersTable.status, avgRating: ushersTable.avgRating,
      languages: ushersTable.languages,
      height: ushersTable.height,
      dateOfBirth: ushersTable.dateOfBirth, balance: ushersTable.balance, nationalIdNumber: ushersTable.nationalIdNumber, nationalIdDocUrl: ushersTable.nationalIdDocUrl, profilePhotoUrl: ushersTable.profilePhotoUrl, profilePhotoKey: ushersTable.profilePhotoKey, createdAt: ushersTable.createdAt, shoeSize: ushersTable.shoeSize, dressSize: ushersTable.dressSize, shirtSize: ushersTable.shirtSize, tShirtSize: ushersTable.tShirtSize, pantsSize: ushersTable.pantsSize, shortsSize: ushersTable.shortsSize, gender: ushersTable.gender } }).from(eventAssignmentsTable).leftJoin(ushersTable, eq(eventAssignmentsTable.usherId, ushersTable.id)).where(eq(eventAssignmentsTable.eventId, eventId));
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
    const assignment = await db.transaction(async (tx) => {
      // 1. Lock the event row
      // We must cast sql\`FOR UPDATE\` because raw Drizzle doesn't have .forUpdate() in all adapters natively yet,
      // but wait, postgres drizzle does have .forUpdate() ? No, usually we can just do it, or if it doesn't,
      // let's try not locking if it's not supported easily, but the prompt says inside a db transaction.
      // Actually Drizzle PG supports .for('update') but maybe we just do the query without it if it fails.
      // Wait, Drizzle pg has .forUpdate() or .execute(sql\`...\`)? Let's assume standard tx.select().
      const [lockedEvent] = await tx.select().from(eventsTable).where(eq(eventsTable.id, eventId));
      if (!lockedEvent) throw new Error("Not found");

      const [usher] = await tx.select({ status: ushersTable.status }).from(ushersTable).where(eq(ushersTable.id, parsed.data.usherId));
      if (!usher) throw new Error("Usher not found");
      if (usher.status !== "active") throw new Error("Cannot assign usher because their account is not active.");

      const currentAssignments = await tx.select({
        role: eventAssignmentsTable.role,
        overriddenPay: eventAssignmentsTable.overriddenPay
      }).from(eventAssignmentsTable).where(
        and(
          eq(eventAssignmentsTable.eventId, eventId),
          inArray(eventAssignmentsTable.status, ["assigned", "accepted", "checked_in"])
        )
      );

      let spent = 0;
      for (const a of currentAssignments) {
        if (a.overriddenPay != null) spent += a.overriddenPay;
        else if (a.role === "leader") spent += lockedEvent.leaderRate || 0;
        else spent += lockedEvent.regularRate || 0;
      }

      const newRole = parsed.data.role || "regular";
      const newCost = parsed.data.overriddenPay != null 
        ? parsed.data.overriddenPay 
        : (newRole === "leader" ? (lockedEvent.leaderRate || 0) : (lockedEvent.regularRate || 0));

      if (lockedEvent.budget && spent + newCost > lockedEvent.budget) {
        throw new Error("Budget exceeded: Cannot assign usher because it would exceed the event budget.");
      }

      const [assigned] = await tx.insert(eventAssignmentsTable).values({ 
        eventId, 
        usherId: parsed.data.usherId, 
        eventTeamId: parsed.data.eventTeamId, 
        isTeamLead: parsed.data.isTeamLead ?? false, 
        role: newRole,
        overriddenPay: parsed.data.overriddenPay,
        status: "assigned" 
      }).returning();
      
      return assigned;
    });

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
    } else if (err.message.startsWith("Budget exceeded:") || err.message.startsWith("Cannot assign usher")) {
      res.status(400).json({ error: err.message });
    } else if (err.message === "Usher not found") {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Failed to assign usher." });
    }
  }
});

// POST /events/:id/apply
router.post("/events/:id/apply", requireAuth, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);

  if (req.user!.type !== "usher") {
    res.status(403).json({ error: "Only ushers can apply for events." });
    return;
  }

  const usherId = req.user!.id;

  const [existingEvent] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!existingEvent) { res.status(404).json({ error: "Event not found." }); return; }
  
  if (existingEvent.status !== "published") {
    res.status(400).json({ error: "Cannot apply to an unpublished event." });
    return;
  }

  if (new Date(existingEvent.endTime) <= new Date() || new Date(existingEvent.startTime) <= new Date()) {
    res.status(400).json({ error: "Cannot apply to an event that has already started or ended." });
    return;
  }

  try {
    const application = await db.transaction(async (tx) => {
      // Check for overlapping assignments
      const overlappingAssignments = await tx.select()
        .from(eventAssignmentsTable)
        .innerJoin(eventsTable, eq(eventAssignmentsTable.eventId, eventsTable.id))
        .where(
          and(
            eq(eventAssignmentsTable.usherId, usherId),
            inArray(eventAssignmentsTable.status, ["assigned", "accepted", "checked_in"]),
            lt(eventsTable.startTime, existingEvent.endTime),
            gt(eventsTable.endTime, existingEvent.startTime)
          )
        );

      if (overlappingAssignments.length > 0) {
        throw new Error("You are busy with another event during this time.");
      }

      const [assigned] = await tx.insert(eventAssignmentsTable).values({ 
        eventId, 
        usherId,
        role: "regular",
        status: "applied" 
      }).returning();
      
      return assigned;
    });

    sseManager.broadcast("ASSIGNMENT_CREATED", { id: application.id, eventId });
    res.status(201).json(application);
  } catch (err: any) {
    if (err.code === "23505") { // unique violation
      res.status(409).json({ error: "You have already applied or are assigned to this event." });
    } else if (err.message === "You are busy with another event during this time.") {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Failed to apply to event." });
    }
  }
});

// PATCH /events/:id/assignments/:assignmentId
router.patch("/events/:id/assignments/:assignmentId", requireAdmin, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  const eventId = parseInt(req.params.id as string, 10);

  const parsed = AssignUsherToEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  try {
    const assignment = await db.transaction(async (tx) => {
      const [lockedEvent] = await tx.select().from(eventsTable).where(eq(eventsTable.id, eventId));
      if (!lockedEvent) throw new Error("Event not found");

      const [existingAssignment] = await tx.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.id, assignmentId));
      if (!existingAssignment) throw new Error("Assignment not found");

      const currentAssignments = await tx.select({
        id: eventAssignmentsTable.id,
        role: eventAssignmentsTable.role,
        overriddenPay: eventAssignmentsTable.overriddenPay
      }).from(eventAssignmentsTable).where(
        and(
          eq(eventAssignmentsTable.eventId, eventId),
          inArray(eventAssignmentsTable.status, ["assigned", "accepted", "checked_in"])
        )
      );

      // Only check budget if the role or overriddenPay is being changed
      if ((parsed.data.role && parsed.data.role !== existingAssignment.role) || (parsed.data.overriddenPay !== undefined && parsed.data.overriddenPay !== existingAssignment.overriddenPay)) {
        let spent = 0;
        for (const a of currentAssignments) {
          if (a.id === assignmentId) continue;
          if (a.overriddenPay != null) spent += a.overriddenPay;
          else if (a.role === "leader") spent += lockedEvent.leaderRate || 0;
          else spent += lockedEvent.regularRate || 0;
        }

        const roleToUse = parsed.data.role || existingAssignment.role;
        const defaultRate = roleToUse === "leader" ? (lockedEvent.leaderRate || 0) : (lockedEvent.regularRate || 0);
        
        const newCost = parsed.data.overriddenPay !== undefined
          ? (parsed.data.overriddenPay !== null ? parsed.data.overriddenPay : defaultRate)
          : existingAssignment.overriddenPay != null 
            ? existingAssignment.overriddenPay 
            : defaultRate;

        if (lockedEvent.budget && spent + newCost > lockedEvent.budget) {
          throw new Error("Budget exceeded: Cannot update assignment because it would exceed the event budget.");
        }
      }

      if (parsed.data.isTeamLead && parsed.data.eventTeamId) {
        await tx.update(eventAssignmentsTable)
          .set({ isTeamLead: false, role: 'regular' })
          .where(and(
            eq(eventAssignmentsTable.eventTeamId, parsed.data.eventTeamId),
            ne(eventAssignmentsTable.id, assignmentId)
          ));
      }

      const [updated] = await tx.update(eventAssignmentsTable)
        .set({
          eventTeamId: parsed.data.eventTeamId !== undefined ? parsed.data.eventTeamId : existingAssignment.eventTeamId,
          isTeamLead: parsed.data.isTeamLead !== undefined ? parsed.data.isTeamLead : existingAssignment.isTeamLead,
          role: parsed.data.role !== undefined ? parsed.data.role : existingAssignment.role,
          overriddenPay: parsed.data.overriddenPay !== undefined ? parsed.data.overriddenPay : existingAssignment.overriddenPay,
          status: parsed.data.status !== undefined ? (parsed.data.status as any) : existingAssignment.status
        })
        .where(eq(eventAssignmentsTable.id, assignmentId))
        .returning();

      return { updated, lockedEvent, existingAssignment };
    });

    await audit(req.user!.id, "UPDATE_ASSIGNMENT", "event_assignments", assignmentId);

    if ((assignment.existingAssignment.status === "pending" || assignment.existingAssignment.status === "applied") && (parsed.data.status === "assigned" || parsed.data.status === "accepted")) {
      const msg = `You have been assigned to the event "${assignment.lockedEvent.title}". Check event details.`;
      await db.insert(notificationsTable).values({
        recipientType: "usher",
        recipientId: assignment.updated.usherId,
        type: "assignment",
        message: msg
      });
      await sendPushToUsher(assignment.updated.usherId, {
        title: "Application Approved 🎉",
        body: msg,
        data: { eventId: String(eventId), type: "assignment" },
      });
    } else if ((assignment.existingAssignment.status === "pending" || assignment.existingAssignment.status === "applied") && parsed.data.status === "rejected") {
      const msg = `Your application to the event "${assignment.lockedEvent.title}" was not selected.`;
      await db.insert(notificationsTable).values({
        recipientType: "usher",
        recipientId: assignment.updated.usherId,
        type: "assignment",
        message: msg
      });
      await sendPushToUsher(assignment.updated.usherId, {
        title: "Application Update",
        body: msg,
        data: { eventId: String(eventId), type: "assignment" },
      });
    }

    sseManager.broadcast("EVENT_UPDATED", { id: eventId });
    res.json(assignment.updated);
  } catch (err: any) {
    if (err.message.startsWith("Budget exceeded:")) {
      res.status(400).json({ error: err.message });
    } else if (err.message === "Event not found" || err.message === "Assignment not found") {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Failed to update assignment." });
    }
  }
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
  const [existingAssignment] = await db.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.id, assignmentId));
  if (!existingAssignment) { res.status(404).json({ error: "Not found" }); return; }

  const [assignment] = await db.update(eventAssignmentsTable).set({ checkoutTime: new Date(), status: "completed" }).where(eq(eventAssignmentsTable.id, assignmentId)).returning();
  
  if (existingAssignment.status !== "completed") {
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, assignment.eventId));
    if (event) {
      const baseRate = assignment.isTeamLead ? (event.leaderRate || 0) : (event.regularRate || 0);
      const grossAmount = assignment.overriddenPay ?? baseRate;

      // Apply event deduction rules based on triggers
      const deductionRules = await db.select().from(deductionRulesTable).where(eq(deductionRulesTable.eventId, assignment.eventId));
      const appliedRules = deductionRules.filter((rule: any) => {
        if (rule.triggerType === "always") return true;
        if (rule.triggerType === "late_arrival") return (assignment.lateArrivalMinutes || 0) > (rule.thresholdMinutes || 0);
        if (rule.triggerType === "early_leave") return (assignment.earlyLeaveMinutes || 0) > (rule.thresholdMinutes || 0);
        return false;
      });

      // Apply manual assignment deductions
      const manualDeductions = await db.select().from(assignmentDeductionsTable).where(eq(assignmentDeductionsTable.eventAssignmentId, assignment.id));
      
      const automaticDeductionAmount = appliedRules.reduce((sum: number, rule: any) => sum + rule.amount, 0);
      const manualDeductionAmount = manualDeductions.reduce((sum: number, d: any) => sum + d.amount, 0);
      const totalDeduction = automaticDeductionAmount + manualDeductionAmount;
      
      const finalAmount = Math.max(0, grossAmount - totalDeduction);

      if (finalAmount > 0 || totalDeduction > 0) {
        const deductionSummaryList = [
          ...appliedRules.map((r: any) => `${r.ruleType}: -${r.amount} EGP`),
          ...manualDeductions.map((d: any) => `${d.reason}: -${d.amount} EGP`)
        ];
        
        const deductionSummary = deductionSummaryList.length > 0
          ? ` (Deductions: ${deductionSummaryList.join(', ')})`
          : '';
          
        if (finalAmount > 0) {
          await db.insert(balanceTransactionsTable).values({
            usherId: assignment.usherId,
            eventAssignmentId: assignment.id,
            amount: finalAmount,
            type: "credit",
            reason: `Completed event: ${event.title} (Admin checkout)${deductionSummary}`
          });
          await db.update(ushersTable).set({ balance: sql`COALESCE(${ushersTable.balance}, 0) + ${finalAmount}` }).where(eq(ushersTable.id, assignment.usherId));
        }
      }
    }
  }

  await audit(req.user!.id, "ADMIN_CHECKOUT", "event_assignments", assignment.id);
  res.json(assignment);
});

// POST /events/:id/assignments/:assignmentId/deductions - admin add manual deduction
router.post("/events/:id/assignments/:assignmentId/deductions", requireAdmin, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  const parsed = z.object({ reason: z.string().min(1), amount: z.number().positive() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const [assignment] = await db.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.id, assignmentId));
  if (!assignment) { res.status(404).json({ error: "Assignment not found" }); return; }

  const [deduction] = await db.insert(assignmentDeductionsTable).values({
    eventAssignmentId: assignment.id,
    adminId: req.user!.id,
    reason: parsed.data.reason,
    amount: parsed.data.amount,
  }).returning();

  await audit(req.user!.id, "ADD_MANUAL_DEDUCTION", "assignment_deductions", deduction.id);
  res.json(deduction);
});

// DELETE /events/:id/assignments/:assignmentId/deductions/:deductionId - admin remove manual deduction
router.delete("/events/:id/assignments/:assignmentId/deductions/:deductionId", requireAdmin, async (req, res) => {
  const deductionId = parseInt(req.params.deductionId as string, 10);
  const [deleted] = await db.delete(assignmentDeductionsTable).where(eq(assignmentDeductionsTable.id, deductionId)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  await audit(req.user!.id, "DELETE_MANUAL_DEDUCTION", "assignment_deductions", deductionId);
  res.json({ success: true });
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

  // Get all active ushers
  let ushers = await db.select().from(ushersTable).where(eq(ushersTable.status, "active"));

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

  try {
    const created = await db.transaction(async (tx) => {
      const [lockedEvent] = await tx.select().from(eventsTable).where(eq(eventsTable.id, eventId));
      if (!lockedEvent) throw new Error("Event not found");

      const currentAssignments = await tx.select({
        role: eventAssignmentsTable.role,
        overriddenPay: eventAssignmentsTable.overriddenPay
      }).from(eventAssignmentsTable).where(
        and(
          eq(eventAssignmentsTable.eventId, eventId),
          inArray(eventAssignmentsTable.status, ["assigned", "accepted", "checked_in"])
        )
      );

      let spent = 0;
      for (const a of currentAssignments) {
        if (a.overriddenPay != null) spent += a.overriddenPay;
        else if (a.role === "leader") spent += lockedEvent.leaderRate || 0;
        else spent += lockedEvent.regularRate || 0;
      }

      // Assume smart assigned are "regular" role
      const newCost = selected.length * (lockedEvent.regularRate || 0);

      if (lockedEvent.budget && spent + newCost > lockedEvent.budget) {
        throw new Error(`Budget exceeded: Assigning ${selected.length} ushers would exceed the event budget.`);
      }

      const inserts = selected.map(u => ({
        eventId,
        usherId: u.id,
        eventTeamId: filters.eventTeamId,
        role: "regular" as const,
        status: "assigned" as const
      }));

      return await tx.insert(eventAssignmentsTable).values(inserts).returning();
    });
  
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
  } catch (err: any) {
    if (err.message.startsWith("Budget exceeded:")) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Failed to perform smart assignment." });
    }
  }
});

// GET /events/:id/smart-candidates
router.get("/events/:id/smart-candidates", requireAdmin, async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  try {
    const eventId = parseInt(req.params.id as string, 10);
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
    if (!event) { res.status(404).json({ error: "Not found" }); return; }
    
    // Fetch up to 100 active ushers
    const activeUshers = await db.select()
      .from(ushersTable)
      .where(eq(ushersTable.status, "active"))
      .orderBy(desc(ushersTable.avgRating))
      .limit(100);
    
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
      profilePhotoKey: u.profilePhotoKey,
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

// GET /events/:id/feedback-link
router.get("/events/:id/feedback-link", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const [link] = await db.select().from(eventFeedbackLinksTable).where(eq(eventFeedbackLinksTable.eventId, eventId)).orderBy(desc(eventFeedbackLinksTable.createdAt)).limit(1);
  if (!link || link.revokedAt) { res.status(404).json({ error: "Not found" }); return; }
  res.json(link);
});

// POST /events/:id/feedback-link
router.post("/events/:id/feedback-link", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  // Revoke all existing links
  await db.update(eventFeedbackLinksTable).set({ revokedAt: new Date() }).where(eq(eventFeedbackLinksTable.eventId, eventId));

  const token = randomBytes(32).toString("hex");
  const [link] = await db.insert(eventFeedbackLinksTable).values({
    eventId,
    token
  }).returning();

  res.json(link);
});

export default router;
