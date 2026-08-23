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
} from "@workspace/db";
import { eq, and, gte, inArray } from "drizzle-orm";

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

  // ── 1. Client Rating Avg ───────────────────────────────────────────────────
  // a) From public event feedback usherOverrides (stored as JSON in event_feedback)
  const feedbackRows = await db
    .select({ usherOverrides: eventFeedbackTable.usherOverrides })
    .from(eventFeedbackTable);

  let clientRatingsTotal = 0;
  let clientRatingsCount = 0;

  for (const row of feedbackRows) {
    if (!row.usherOverrides) continue;
    let overrides: { usherId: number; rating: number }[] = [];
    try {
      overrides = typeof row.usherOverrides === "string"
        ? JSON.parse(row.usherOverrides)
        : (row.usherOverrides as any[]);
    } catch { continue; }
    for (const o of overrides) {
      if (o.usherId === usherId && o.rating > 0) {
        clientRatingsTotal += o.rating;
        clientRatingsCount++;
      }
    }
  }

  // b) From manual ratings (admin/holder) linked to this usher's assignments
  const assignments = await db
    .select({ id: eventAssignmentsTable.id, checkinTime: eventAssignmentsTable.checkinTime,
      lateArrivalMinutes: eventAssignmentsTable.lateArrivalMinutes,
      earlyLeaveMinutes: eventAssignmentsTable.earlyLeaveMinutes })
    .from(eventAssignmentsTable)
    .where(eq(eventAssignmentsTable.usherId, usherId));

  const assignmentIds = assignments.map((a) => a.id);

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

  let reliabilityScore = 5;
  for (const ev of reliabilityEvents) {
    if (ev.type === "no_show") reliabilityScore -= cfg.noShowPenalty;
    else if (ev.type === "late_cancellation") reliabilityScore -= cfg.lateCancellationPenalty;
  }
  reliabilityScore = parseFloat(Math.max(0, Math.min(5, reliabilityScore)).toFixed(2));

  // ── 4. Composite ──────────────────────────────────────────────────────────
  let { clientRatingWeight, punctualityWeight, reliabilityWeight } = cfg;

  // If no client ratings yet, renormalize other weights
  let effectiveClientRating = clientRatingAvg;
  if (effectiveClientRating === null) {
    const remaining = punctualityWeight + reliabilityWeight;
    if (remaining > 0) {
      punctualityWeight = punctualityWeight / remaining;
      reliabilityWeight = reliabilityWeight / remaining;
    }
    effectiveClientRating = 0; // won't contribute
    clientRatingWeight = 0;
  }

  const composite = parseFloat(
    (
      (effectiveClientRating * clientRatingWeight) +
      ((punctualityScore ?? 5) * punctualityWeight) +
      (reliabilityScore * reliabilityWeight)
    ).toFixed(2)
  );

  // ── 5. Persist ────────────────────────────────────────────────────────────
  await db.update(ushersTable).set({
    avgRating: composite,
    clientRatingAvg: clientRatingAvg ?? undefined,
    punctualityScore: punctualityScore ?? undefined,
    reliabilityScore,
    lastRatingRecalcAt: new Date(),
  }).where(eq(ushersTable.id, usherId));
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
