import { Router } from "express";
import { db, eventAssignmentsTable, eventsTable, ushersTable, deductionRulesTable, cancellationsTable, balanceTransactionsTable, eventTeamsTable, waitlistTable, reliabilityEventsTable, systemSettingsTable, DEFAULT_RATING_CONFIG } from "@workspace/db";
import { eq, and, ne, sql, inArray, lt } from "drizzle-orm";
import { requireUsher } from "../middleware/auth.js";
import {
  DeclineAssignmentBody,
  UsherCheckinBody,
  CancelAssignmentBody,
} from "@workspace/api-zod";
import { calculateAndApplyAutoRating, recalculateUsherCompositeRating } from "../lib/auto-rating-engine.js";

const router = Router();

async function buildMyAssignment(assignment: any) {
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, assignment.eventId));
  const deductionRules = await db.select().from(deductionRulesTable).where(eq(deductionRulesTable.eventId, assignment.eventId));
  
  let teamRows: any[] = [];
  let team = null;
  
  if (assignment.eventTeamId) {
    const [t] = await db.select().from(eventTeamsTable).where(eq(eventTeamsTable.id, assignment.eventTeamId));
    team = t || null;
  }
  
  const allTeams = await db.select().from(eventTeamsTable).where(eq(eventTeamsTable.eventId, assignment.eventId));
  
  const allEventMembers = await db.select({
    id: ushersTable.id, 
    fullName: ushersTable.fullName, 
    profilePhotoUrl: ushersTable.profilePhotoUrl, 
    isTeamLead: eventAssignmentsTable.isTeamLead,
    phone: ushersTable.phone,
    status: eventAssignmentsTable.status,
    eventTeamId: eventAssignmentsTable.eventTeamId
  }).from(eventAssignmentsTable)
    .innerJoin(ushersTable, eq(eventAssignmentsTable.usherId, ushersTable.id))
    .where(and(
      eq(eventAssignmentsTable.eventId, assignment.eventId), 
      inArray(eventAssignmentsTable.status, ["assigned", "accepted", "checked_in", "checked_out"])
    ));

  // Keep teamMembers populated for backward compatibility, but include everyone in the team (even current user)
  teamRows = allEventMembers.filter(m => m.eventTeamId === assignment.eventTeamId);

  const eventDetail = { ...event, assignments: [], deductionRules };
  return { id: assignment.id, eventId: assignment.eventId, status: assignment.status, isTeamLead: assignment.isTeamLead, role: assignment.role, overriddenPay: assignment.overriddenPay, checkinTime: assignment.checkinTime, checkoutTime: assignment.checkoutTime, checkinMethod: assignment.checkinMethod, event: eventDetail, teamMembers: teamRows, team, allTeams, allEventMembers };
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /my/assignments
router.get("/my/assignments", requireUsher, async (req, res) => {
  // Auto-completion logic moved to the background cron job to prevent slow page loads

  const { status } = req.query as Record<string, string>;
  let query = db.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.usherId, req.user!.id)).$dynamic();
  if (status && status !== "all") {
    const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      query = query.where(and(eq(eventAssignmentsTable.usherId, req.user!.id), eq(eventAssignmentsTable.status, statuses[0])));
    } else if (statuses.length > 1) {
      query = query.where(and(eq(eventAssignmentsTable.usherId, req.user!.id), inArray(eventAssignmentsTable.status, statuses)));
    }
  }
  const rows = await query;
  const result = await Promise.all(rows.map(buildMyAssignment));

  // Automatically mark missed assignments as no_show
  const now = new Date();
  const expiredIds: number[] = [];
  
  for (const item of result) {
    if (new Date(item.event.endTime) < now && (item.status === "assigned" || item.status === "accepted")) {
      item.status = "no_show";
      expiredIds.push(item.id);
    }
  }
  
  if (expiredIds.length > 0) {
    await db.update(eventAssignmentsTable)
      .set({ status: "no_show" })
      .where(inArray(eventAssignmentsTable.id, expiredIds));

    // Log reliability events and trigger recalculation for each no-show usher
    const noShowItems = result.filter(item => expiredIds.includes(item.id));
    for (const item of noShowItems) {
      try {
        await db.insert(reliabilityEventsTable).values({ usherId: req.user!.id, eventId: item.eventId, type: "no_show" });
        recalculateUsherCompositeRating(req.user!.id).catch(() => {});
      } catch { /* non-critical */ }
    }
  }

  // Filter out items that no longer match the requested status
  let finalResult = result;
  if (status && status !== "all") {
    const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
    finalResult = result.filter(item => statuses.includes(item.status));
  }

  // Never show draft events to ushers
  finalResult = finalResult.filter(item => item.event?.status !== "draft");

  res.json(finalResult);
});

// POST /my/assignments/:assignmentId/accept
router.post("/my/assignments/:assignmentId/accept", requireUsher, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  const [existingAssignment] = await db.select().from(eventAssignmentsTable).where(and(eq(eventAssignmentsTable.id, assignmentId), eq(eventAssignmentsTable.usherId, req.user!.id)));
  if (!existingAssignment) { res.status(404).json({ error: "Not found" }); return; }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, existingAssignment.eventId));
  if (event.status === "completed" || new Date(event.endTime) < new Date()) {
    res.status(400).json({ error: "Cannot accept an assignment for a completed event." });
    return;
  }

  const [assignment] = await db.update(eventAssignmentsTable).set({ status: "accepted" }).where(eq(eventAssignmentsTable.id, assignmentId)).returning();
  if (!assignment) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildMyAssignment(assignment));
});

// POST /my/assignments/:assignmentId/decline
router.post("/my/assignments/:assignmentId/decline", requireUsher, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  const [assignment] = await db.update(eventAssignmentsTable).set({ status: "declined" }).where(and(eq(eventAssignmentsTable.id, assignmentId), eq(eventAssignmentsTable.usherId, req.user!.id))).returning();
  if (!assignment) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildMyAssignment(assignment));
});

// POST /my/assignments/:assignmentId/checkin
router.post("/my/assignments/:assignmentId/checkin", requireUsher, async (req, res) => {
  const parsed = UsherCheckinBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { lat, lng } = parsed.data;
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  const [assignment] = await db.select().from(eventAssignmentsTable).where(and(eq(eventAssignmentsTable.id, assignmentId), eq(eventAssignmentsTable.usherId, req.user!.id)));
  if (!assignment) { res.status(404).json({ error: "Not found" }); return; }
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, assignment.eventId));
  if (event.venueLat && event.venueLng) {
    const dist = haversineMeters(lat, lng, event.venueLat, event.venueLng);
    if (dist > (event.checkinRadiusM ?? 100)) {
      res.status(400).json({ error: `You are ${Math.round(dist)}m away from the venue. Must be within ${event.checkinRadiusM ?? 100}m.` });
      return;
    }
  } else {
    res.status(400).json({ error: "Event location is not set by the admin. Cannot verify GPS." });
    return;
  }
  const now = new Date();
  
  if (event.startTime) {
    const eventStart = new Date(event.startTime);
    const earlyMinutes = (eventStart.getTime() - now.getTime()) / 60000;
    const windowMinutes = (event as any).checkinWindowMinutes ?? 5; // using any since type might not be updated in DB schema yet if build hasn't run
    if (earlyMinutes > windowMinutes) {
      res.status(400).json({ error: `Check-in opens ${windowMinutes} minutes before the event starts. Please wait ${Math.ceil(earlyMinutes - windowMinutes)} more minutes.` });
      return;
    }
  }
  // Calculate late arrival: how many minutes after event start
  const lateArrivalMinutes = event.startTime
    ? Math.max(0, Math.round((now.getTime() - new Date(event.startTime).getTime()) / 60000))
    : 0;
  const [updated] = await db.update(eventAssignmentsTable).set({ checkinTime: now, checkinLat: lat, checkinLng: lng, checkinMethod: "gps", status: "checked_in", lateArrivalMinutes } as any).where(eq(eventAssignmentsTable.id, assignment.id)).returning();
  res.json(await buildMyAssignment(updated));
});

// POST /my/assignments/:assignmentId/team-checkin/:usherId
router.post("/my/assignments/:assignmentId/team-checkin/:usherId", requireUsher, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  const usherId = parseInt(req.params.usherId as string, 10);

  // 1. Fetch the team leader's assignment to ensure they are the leader for this event/team
  const [leaderAssignment] = await db
    .select()
    .from(eventAssignmentsTable)
    .where(
      and(
        eq(eventAssignmentsTable.id, assignmentId),
        eq(eventAssignmentsTable.usherId, req.user!.id)
      )
    );

  if (!leaderAssignment || !leaderAssignment.isTeamLead) {
    res.status(403).json({ error: "Only team leaders can perform team check-ins." });
    return;
  }

  // 2. Fetch the target team member's assignment
  const [memberAssignment] = await db
    .select()
    .from(eventAssignmentsTable)
    .where(
      and(
        eq(eventAssignmentsTable.eventId, leaderAssignment.eventId),
        eq(eventAssignmentsTable.eventTeamId, leaderAssignment.eventTeamId!),
        eq(eventAssignmentsTable.usherId, usherId)
      )
    );

  if (!memberAssignment) {
    res.status(404).json({ error: "Team member not found in your team." });
    return;
  }

  if (memberAssignment.status === "checked_in") {
    res.status(400).json({ error: "Member is already checked in." });
    return;
  }

  if (memberAssignment.status !== "accepted" && memberAssignment.status !== "assigned") {
    res.status(400).json({ error: "Member cannot be checked in (status: " + memberAssignment.status + ")." });
    return;
  }

  // 3. Update the member's status to checked_in
  const [updatedAssignment] = await db
    .update(eventAssignmentsTable)
    .set({
      status: "checked_in",
      checkinTime: new Date(),
      checkinMethod: "team_leader",
    })
    .where(eq(eventAssignmentsTable.id, memberAssignment.id))
    .returning();

  res.json(await buildMyAssignment(leaderAssignment));
});

// POST /my/assignments/:assignmentId/checkout
router.post("/my/assignments/:assignmentId/checkout", requireUsher, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  const { lat, lng } = req.body || {};
  
  const [assignment] = await db.select().from(eventAssignmentsTable).where(and(eq(eventAssignmentsTable.id, assignmentId), eq(eventAssignmentsTable.usherId, req.user!.id)));
  if (!assignment) { res.status(404).json({ error: "Not found" }); return; }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, assignment.eventId));
  if (event && event.venueLat && event.venueLng) {
    if (lat === undefined || lng === undefined || lat === null || lng === null) {
      res.status(400).json({ error: "GPS location is required to check out." });
      return;
    }
    const dist = haversineMeters(Number(lat), Number(lng), event.venueLat, event.venueLng);
    const maxRadius = event.checkinRadiusM ?? 100;
    if (dist > maxRadius) {
      res.status(400).json({ error: `You are ${Math.round(dist)}m away from the venue. Must be within ${maxRadius}m range to check out.` });
      return;
    }
  } else {
    res.status(400).json({ error: "Event location is not set by the admin. Cannot verify GPS checkout." });
    return;
  }

  const checkoutNow = new Date();

  if (event.endTime) {
    const end = new Date(event.endTime);
    const minutesPastEnd = (checkoutNow.getTime() - end.getTime()) / 60000;
    if (minutesPastEnd > 15) {
      res.status(400).json({ error: "You cannot check out. The check-out window closed 15 minutes after the event ended. Please contact the admin." });
      return;
    }
  }

  // Calculate early leave: how many minutes before event end the usher left
  const earlyLeaveMinutes = event.endTime
    ? Math.max(0, Math.round((new Date(event.endTime).getTime() - checkoutNow.getTime()) / 60000))
    : 0;
  const [updated] = await db.update(eventAssignmentsTable).set({ checkoutTime: checkoutNow, checkoutLat: lat ? Number(lat) : null, checkoutLng: lng ? Number(lng) : null, status: "completed", earlyLeaveMinutes } as any).where(eq(eventAssignmentsTable.id, assignment.id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  // Automatically add balance payout
  if (assignment.status !== "completed") {
    const baseRate = assignment.isTeamLead ? (event.leaderRate || 0) : (event.regularRate || 0);
    const amount = assignment.overriddenPay ?? baseRate;
    if (amount > 0) {
      await db.insert(balanceTransactionsTable).values({
        usherId: assignment.usherId,
        eventAssignmentId: assignment.id,
        amount,
        type: "credit",
        reason: `Completed event: ${event.title}`
      });
      await db.update(ushersTable).set({ balance: sql`COALESCE(${ushersTable.balance}, 0) + ${amount}` }).where(eq(ushersTable.id, assignment.usherId));
    }
  }

  // Trigger composite rating recalculation (fire-and-forget)
  recalculateUsherCompositeRating(assignment.usherId).catch(() => {});
  res.json(await buildMyAssignment(updated));
});

// POST /my/assignments/:assignmentId/cancel
router.post("/my/assignments/:assignmentId/cancel", requireUsher, async (req, res) => {
  const parsed = CancelAssignmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const assignmentId = parseInt(req.params.assignmentId as string, 10);

  // Load the assignment BEFORE cancelling to get event info for late-cancel check
  const [existingAssignment] = await db
    .select({ id: eventAssignmentsTable.id, usherId: eventAssignmentsTable.usherId, eventId: eventAssignmentsTable.eventId, status: eventAssignmentsTable.status })
    .from(eventAssignmentsTable)
    .where(and(eq(eventAssignmentsTable.id, assignmentId), eq(eventAssignmentsTable.usherId, req.user!.id)));
  if (!existingAssignment) { res.status(404).json({ error: "Not found" }); return; }

  const [assignment] = await db.update(eventAssignmentsTable).set({ status: "cancelled" }).where(eq(eventAssignmentsTable.id, assignmentId)).returning();
  if (!assignment) { res.status(404).json({ error: "Not found" }); return; }
  const [cancellation] = await db.insert(cancellationsTable).values({ eventAssignmentId: assignment.id, reason: parsed.data.reason ?? null, penaltyApplied: false }).returning();

  // Check if this is a late cancellation (within configurable window before event start)
  try {
    const [event] = await db.select({ startTime: eventsTable.startTime }).from(eventsTable).where(eq(eventsTable.id, existingAssignment.eventId));
    const [cfgRow] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "ratingConfig"));
    const cfg = (cfgRow?.value ?? DEFAULT_RATING_CONFIG) as typeof DEFAULT_RATING_CONFIG;
    if (event && ["accepted", "assigned"].includes(existingAssignment.status ?? "")) {
      const hoursUntilEvent = (new Date(event.startTime).getTime() - Date.now()) / 3600000;
      if (hoursUntilEvent >= 0 && hoursUntilEvent <= cfg.lateCancellationWindowHours) {
        await db.insert(reliabilityEventsTable).values({ usherId: existingAssignment.usherId, eventId: existingAssignment.eventId, type: "late_cancellation" });
        recalculateUsherCompositeRating(existingAssignment.usherId).catch(() => {});
      }
    }
  } catch { /* non-critical */ }

  const ma = await buildMyAssignment(assignment);
  res.json({ assignment: ma, cancellation, penaltyApplied: false, penaltyAmount: null });
});

// GET /my/waitlists
router.get("/my/waitlists", requireUsher, async (req, res) => {
  const waitlists = await db.select({
    id: waitlistTable.id,
    eventId: waitlistTable.eventId,
    usherId: waitlistTable.usherId,
    priorityOrder: waitlistTable.priorityOrder,
    status: waitlistTable.status,
    event: eventsTable
  }).from(waitlistTable)
    .innerJoin(eventsTable, eq(waitlistTable.eventId, eventsTable.id))
    .where(eq(waitlistTable.usherId, req.user!.id));

  res.json(waitlists);
});

// POST /my/waitlists/:waitlistId/accept
router.post("/my/waitlists/:waitlistId/accept", requireUsher, async (req, res) => {
  const waitlistId = parseInt(req.params.waitlistId as string, 10);
  const [existing] = await db.select({
    waitlist: waitlistTable,
    event: eventsTable
  }).from(waitlistTable)
    .innerJoin(eventsTable, eq(waitlistTable.eventId, eventsTable.id))
    .where(and(eq(waitlistTable.id, waitlistId), eq(waitlistTable.usherId, req.user!.id)));
  
  if (!existing) {
    res.status(404).json({ error: "Waitlist entry not found" });
    return;
  }

  if (existing.event.status === "completed" || new Date(existing.event.endTime) < new Date()) {
    res.status(400).json({ error: "Cannot accept a waitlist for a completed event." });
    return;
  }

  const [updated] = await db.update(waitlistTable)
    .set({ status: 'accepted' })
    .where(eq(waitlistTable.id, existing.waitlist.id))
    .returning();

  res.json(updated);
});

// POST /my/waitlists/:waitlistId/reject
router.post("/my/waitlists/:waitlistId/reject", requireUsher, async (req, res) => {
  const waitlistId = parseInt(req.params.waitlistId as string, 10);
  const [existing] = await db.select({
    waitlist: waitlistTable,
    event: eventsTable
  }).from(waitlistTable)
    .innerJoin(eventsTable, eq(waitlistTable.eventId, eventsTable.id))
    .where(and(eq(waitlistTable.id, waitlistId), eq(waitlistTable.usherId, req.user!.id)));
  
  if (!existing) {
    res.status(404).json({ error: "Waitlist entry not found" });
    return;
  }

  if (existing.event.status === "completed" || new Date(existing.event.endTime) < new Date()) {
    res.status(400).json({ error: "Cannot decline a waitlist for a completed event." });
    return;
  }

  const [updated] = await db.update(waitlistTable)
    .set({ status: 'rejected' })
    .where(eq(waitlistTable.id, existing.waitlist.id))
    .returning();

  res.json(updated);
});

export default router;
