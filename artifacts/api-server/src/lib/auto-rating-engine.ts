import { db, ratingsTable, eventAssignmentsTable, eventsTable, ushersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function updateUsherAvgRating(usherId: number) {
  const assignments = await db
    .select({ id: eventAssignmentsTable.id })
    .from(eventAssignmentsTable)
    .where(eq(eventAssignmentsTable.usherId, usherId));

  const assignmentIds = assignments.map((a) => a.id);
  if (!assignmentIds.length) return;

  const allRatings = await Promise.all(
    assignmentIds.map((id) =>
      db
        .select({ ratingValue: ratingsTable.ratingValue })
        .from(ratingsTable)
        .where(eq(ratingsTable.eventAssignmentId, id))
    )
  );

  const flat = allRatings.flat();
  if (!flat.length) return;

  const average = flat.reduce((sum, r) => sum + r.ratingValue, 0) / flat.length;
  await db
    .update(ushersTable)
    .set({ avgRating: parseFloat(average.toFixed(2)) })
    .where(eq(ushersTable.id, usherId));
}

export async function calculateAndApplyAutoRating(assignmentId: number) {
  // Check if rating already exists for this assignment
  const existingRatings = await db
    .select()
    .from(ratingsTable)
    .where(eq(ratingsTable.eventAssignmentId, assignmentId));

  if (existingRatings.length > 0) {
    // Rating already exists (manual or previous system rating)
    return existingRatings[0];
  }

  // Fetch assignment & event details
  const [assignment] = await db
    .select()
    .from(eventAssignmentsTable)
    .where(eq(eventAssignmentsTable.id, assignmentId));

  if (!assignment) return null;

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, assignment.eventId));

  if (!event) return null;

  let baseScore = 5;
  const penalties: string[] = [];

  // Check-in Evaluation
  if (assignment.checkinTime && event.startTime) {
    const checkin = new Date(assignment.checkinTime).getTime();
    const start = new Date(event.startTime).getTime();
    const diffMinutes = Math.floor((checkin - start) / 60000);

    if (diffMinutes > 15 && diffMinutes <= 30) {
      baseScore -= 1;
      penalties.push(`Checked in ${diffMinutes} mins late (-1 star)`);
    } else if (diffMinutes > 30) {
      baseScore -= 2;
      penalties.push(`Checked in ${diffMinutes} mins late (-2 stars)`);
    }
  }

  // Check-out Evaluation
  if (assignment.checkoutTime && event.endTime) {
    const checkout = new Date(assignment.checkoutTime).getTime();
    const end = new Date(event.endTime).getTime();
    const earlyMinutes = Math.floor((end - checkout) / 60000);

    if (earlyMinutes > 0 && earlyMinutes <= 15) {
      baseScore -= 1;
      penalties.push(`Checked out ${earlyMinutes} mins early (-1 star)`);
    } else if (earlyMinutes > 15) {
      baseScore -= 2;
      penalties.push(`Checked out ${earlyMinutes} mins early (-2 stars)`);
    }
  }

  // No Show evaluation
  if (assignment.status === "no_show") {
    baseScore = 1;
    penalties.push("No Show for assigned shift (-4 stars)");
  }

  // Clamp final score between 1 and 5
  const finalRating = Math.max(1, Math.min(5, baseScore));
  const comment =
    penalties.length > 0
      ? `System Auto-Rating: ${penalties.join(", ")}`
      : "System Auto-Rating: Perfect attendance and on-time performance (5 Stars)";

  // Insert auto rating
  const [newRating] = await db
    .insert(ratingsTable)
    .values({
      eventAssignmentId: assignmentId,
      ratedByType: "system",
      ratingValue: finalRating,
      comment,
    })
    .returning();

  // Re-calculate global average rating for usher
  await updateUsherAvgRating(assignment.usherId);

  return newRating;
}
