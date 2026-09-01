/**
 * Composite Usher Rating Engine
 *
 * Recalculates a usher's composite rating from three components:
 *   - clientRatingAvg: average of all public feedback star ratings for this usher
 *   - punctualityScore: average per-event punctuality score (0–5)
 *   - reliabilityScore: 5.0 minus penalties from no-shows / late cancellations in rolling window
 *
 * The overall composite (avgRating) = weighted sum of the three, stored on ushers table.
 * Weights and thresholds come from system_settings["ratingConfig"].
 */

import {
  db,
  ushersTable,
  eventAssignmentsTable,
  ratingsTable,
  eventFeedbackTable,
  reliabilityEventsTable,
  systemSettingsTable,
  DEFAULT_RATING_CONFIG,
  type RatingConfig,
  eventsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, gte, inArray, gt } from "drizzle-orm";
import { sendPushToUsher } from "./fcm.js";

/** Load current rating config from DB, fall back to defaults if not set. */
async function loadRatingConfig(): Promise<RatingConfig> {
  const [row] = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "ratingConfig"));
  if (row) return row.value as RatingConfig;
  return DEFAULT_RATING_CONFIG;
}

/**
 * Compute punctuality score for a single assignment.
 * Uses lateArrivalMinutes and earlyLeaveMinutes already stored on the assignment.
 * Returns null if the usher never checked in (didn't attend).
 */
function computePunctualityForAssignment(
  lateArrivalMinutes: number,
  earlyLeaveMinutes: number,
  cfg: RatingConfig
): number {
  let score = 5;
  const { gracePeriodMinutes, punctualityPenaltyPerInterval, punctualityIntervalMinutes } = cfg;

  const lateBeyondGrace = Math.max(0, lateArrivalMinutes - gracePeriodMinutes);
  const earlyBeyondGrace = Math.max(0, earlyLeaveMinutes - gracePeriodMinutes);

  score -= Math.floor(lateBeyondGrace / punctualityIntervalMinutes) * punctualityPenaltyPerInterval;
  score -= Math.floor(earlyBeyondGrace / punctualityIntervalMinutes) * punctualityPenaltyPerInterval;

  return Math.max(0, Math.min(5, score));
}

/** Recalculate and persist composite rating for one usher. */
export async function recalculateUsherCompositeRating(usherId: number): Promise<void> {
  const cfg = await loadRatingConfig();

  // ── 1. Fetch Assignments ─────────────────────────────────────────────────────
  // Get all assignments for this usher (needed for both manual ratings and finding their team for public feedback)
  const assignments = await db
    .select({ 
      id: eventAssignmentsTable.id, 
      eventId: eventAssignmentsTable.eventId,
      eventTeamId: eventAssignmentsTable.eventTeamId,
      checkinTime: eventAssignmentsTable.checkinTime,
      lateArrivalMinutes: eventAssignmentsTable.lateArrivalMinutes,
      earlyLeaveMinutes: eventAssignmentsTable.earlyLeaveMinutes 
    })
    .from(eventAssignmentsTable)
    .where(eq(eventAssignmentsTable.usherId, usherId));

  const assignmentIds = assignments.map((a) => a.id);
  const eventTeamMap = new Map<number, number | null>(); // eventId -> eventTeamId
  for (const a of assignments) {
    eventTeamMap.set(a.eventId, a.eventTeamId);
  }

  let clientRatingsTotal = 0;
  let clientRatingsCount = 0;

  // ── 2. Client Rating Avg ───────────────────────────────────────────────────
  // a) From public event feedback (teamRatings + usherOverrides)
  const feedbackRows = await db
    .select({ 
      eventId: eventFeedbackTable.eventId,
      usherOverrides: eventFeedbackTable.usherOverrides,
      teamRatings: eventFeedbackTable.teamRatings
    })
    .from(eventFeedbackTable);

  for (const row of feedbackRows) {
    // Only process events the usher was actually assigned to
    if (!eventTeamMap.has(row.eventId)) continue;

    let overrideRating: number | null = null;
    
    // Check if usher has an explicit override
    if (row.usherOverrides) {
      try {
        const overrides = typeof row.usherOverrides === "string" 
          ? JSON.parse(row.usherOverrides) 
          : (row.usherOverrides as any[]);
        const match = overrides.find((o: any) => o.usherId === usherId);
        if (match && match.rating > 0) {
          overrideRating = match.rating;
        }
      } catch {}
    }

    if (overrideRating !== null) {
      // Use the usher-specific rating
      clientRatingsTotal += overrideRating;
      clientRatingsCount++;
    } else if (row.teamRatings) {
      // Fallback to their team rating for that event
      try {
        const teamId = eventTeamMap.get(row.eventId) || 0; // 0 represents "General" unassigned team
        const teamRatings = typeof row.teamRatings === "string"
          ? JSON.parse(row.teamRatings)
          : (row.teamRatings as any[]);
        
        const match = teamRatings.find((t: any) => t.teamId === teamId);
        if (match && match.rating > 0) {
          clientRatingsTotal += match.rating;
          clientRatingsCount++;
        }
      } catch {}
    }
  }

  // b) From manual ratings (admin/holder) linked to this usher's assignments
  if (assignmentIds.length > 0) {
    const manualRatings = await db
      .select({ ratingValue: ratingsTable.ratingValue, ratedByType: ratingsTable.ratedByType })
      .from(ratingsTable)
      .where(
        and(
          inArray(ratingsTable.eventAssignmentId, assignmentIds),
          inArray(ratingsTable.ratedByType, ["holder", "admin"])
        )
      );
    for (const r of manualRatings) {
      clientRatingsTotal += r.ratingValue;
      clientRatingsCount++;
    }
  }

  const clientRatingAvg = clientRatingsCount > 0
    ? parseFloat((clientRatingsTotal / clientRatingsCount).toFixed(2))
    : null;

  // ── 2. Punctuality Score ───────────────────────────────────────────────────
  // Only count assignments where usher actually checked in
  const attendedAssignments = assignments.filter((a) => a.checkinTime !== null);
  let punctualityScore: number | null = null;

  if (attendedAssignments.length > 0) {
    const scores = attendedAssignments.map((a) =>
      computePunctualityForAssignment(
        a.lateArrivalMinutes ?? 0,
        a.earlyLeaveMinutes ?? 0,
        cfg
      )
    );
    punctualityScore = parseFloat(
      (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2)
    );
  }

  // ── 3. Reliability Score ───────────────────────────────────────────────────
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - cfg.reliabilityWindowDays);

  const reliabilityEvents = await db
    .select({ type: reliabilityEventsTable.type })
    .from(reliabilityEventsTable)
    .where(
      and(
        eq(reliabilityEventsTable.usherId, usherId),
        gte(reliabilityEventsTable.occurredAt, windowStart)
      )
    );

  let reliabilityScore: number | null = null;
  if (attendedAssignments.length > 0 || reliabilityEvents.length > 0 || clientRatingsCount > 0) {
    reliabilityScore = 5;
    for (const ev of reliabilityEvents) {
      if (ev.type === "no_show") reliabilityScore -= cfg.noShowPenalty;
      else if (ev.type === "late_cancellation") reliabilityScore -= cfg.lateCancellationPenalty;
    }
    reliabilityScore = parseFloat(Math.max(0, Math.min(5, reliabilityScore)).toFixed(2));
  }

  // ── 4. Composite ──────────────────────────────────────────────────────────
  let { clientRatingWeight, punctualityWeight, reliabilityWeight } = cfg;

  let composite = 0;

  if (clientRatingAvg === null && punctualityScore === null && reliabilityScore === null) {
    // Brand new usher, no history at all
    composite = 0;
  } else {
    // Calculate total weight for the metrics we actually have
    let totalWeight = 0;
    if (clientRatingAvg !== null) totalWeight += clientRatingWeight;
    if (punctualityScore !== null) totalWeight += punctualityWeight;
    if (reliabilityScore !== null) totalWeight += reliabilityWeight;

    if (totalWeight > 0) {
      let calc = 0;
      if (clientRatingAvg !== null) calc += clientRatingAvg * (clientRatingWeight / totalWeight);
      if (punctualityScore !== null) calc += punctualityScore * (punctualityWeight / totalWeight);
      if (reliabilityScore !== null) calc += reliabilityScore * (reliabilityWeight / totalWeight);
      
      composite = parseFloat(calc.toFixed(2));
    }
  }

  // ── 5. Persist ────────────────────────────────────────────────────────────
  await db.update(ushersTable).set({
    avgRating: composite,
    clientRatingAvg: clientRatingAvg ?? undefined,
    punctualityScore: punctualityScore ?? undefined,
    reliabilityScore: reliabilityScore ?? undefined,
    lastRatingRecalcAt: new Date(),
  }).where(eq(ushersTable.id, usherId));

  // ── 6. Auto-Suspension & Upcoming Cancellation ────────────────────────────
  if (reliabilityEvents.length >= cfg.reliabilityFlagThreshold) {
    const [usher] = await db.select({ status: ushersTable.status }).from(ushersTable).where(eq(ushersTable.id, usherId));
    if (usher && usher.status !== "suspended" && usher.status !== "blacklisted" && usher.status !== "declined") {
      // Auto-suspend the usher
      await db.update(ushersTable).set({ status: "suspended" }).where(eq(ushersTable.id, usherId));

      // Find future assignments
      const futureAssignments = await db.select({ id: eventAssignmentsTable.id })
        .from(eventAssignmentsTable)
        .innerJoin(eventsTable, eq(eventAssignmentsTable.eventId, eventsTable.id))
        .where(
          and(
            eq(eventAssignmentsTable.usherId, usherId),
            inArray(eventAssignmentsTable.status, ["assigned", "accepted"]),
            gt(eventsTable.startTime, new Date())
          )
        );

      if (futureAssignments.length > 0) {
        const ids = futureAssignments.map(a => a.id);
        await db.update(eventAssignmentsTable).set({ status: "cancelled" }).where(inArray(eventAssignmentsTable.id, ids));
      }

      // Notify the usher
      const title = "Account Suspended";
      const body = "Your account has been automatically suspended due to repeated reliability issues (e.g. no-shows). All your upcoming assignments have been cancelled.";
      await db.insert(notificationsTable).values({
        recipientType: "usher",
        recipientId: usherId,
        type: "status_update",
        message: body,
      });
      await sendPushToUsher(usherId, { title, body }).catch(() => {});
    }
  }
}

/** Recalculate composite ratings for ALL ushers (used after weight change). */
export async function recalculateAllUsherRatings(): Promise<void> {
  const allUshers = await db.select({ id: ushersTable.id }).from(ushersTable);
  await Promise.allSettled(allUshers.map((u) => recalculateUsherCompositeRating(u.id)));
}

/** Legacy: kept for backwards compatibility with existing callers. */
export async function updateUsherAvgRating(usherId: number): Promise<void> {
  await recalculateUsherCompositeRating(usherId);
}

/** Legacy: kept for backwards compatibility. Now recalculates composite instead of inserting a system rating. */
export async function calculateAndApplyAutoRating(assignmentId: number): Promise<void> {
  const [assignment] = await db
    .select({ usherId: eventAssignmentsTable.usherId })
    .from(eventAssignmentsTable)
    .where(eq(eventAssignmentsTable.id, assignmentId));
  if (assignment) {
    await recalculateUsherCompositeRating(assignment.usherId);
  }
}
