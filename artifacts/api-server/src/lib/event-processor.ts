import { db, eventsTable, eventAssignmentsTable, deductionRulesTable, assignmentDeductionsTable, balanceTransactionsTable, ushersTable, reliabilityEventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { recalculateUsherCompositeRating } from "./auto-rating-engine.js";

export async function processEventCompletion(eventId: number) {
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event) throw new Error("Event not found");

  if (event.status === "completed" || event.status === "cancelled") {
    throw new Error(`Event is already ${event.status}`);
  }

  await db.transaction(async (tx) => {
    // 1. Fetch all assignments for this event
    const assignments = await tx.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.eventId, event.id));
    
    for (const assignment of assignments) {
      if (assignment.status === "completed" || assignment.status === "cancelled" || assignment.status === "rejected") {
        continue;
      }

      if (assignment.status === "assigned" || assignment.status === "accepted") {
        // No-Show penalty
        await tx.update(eventAssignmentsTable)
          .set({ status: "cancelled" })
          .where(eq(eventAssignmentsTable.id, assignment.id));
        
        await tx.insert(reliabilityEventsTable).values({
          usherId: assignment.usherId,
          eventId: event.id,
          type: "no_show"
        });

        await recalculateUsherCompositeRating(assignment.usherId);
      } else if (assignment.status === "checked_in") {
        // Force checkout at event endTime
        const checkoutTime = event.endTime ? new Date(event.endTime) : new Date();
        const [updatedAssignment] = await tx.update(eventAssignmentsTable)
          .set({ checkoutTime, status: "completed" })
          .where(eq(eventAssignmentsTable.id, assignment.id))
          .returning();

        // Calculate payouts
        const baseRate = updatedAssignment.isTeamLead ? (event.leaderRate || 0) : (event.regularRate || 0);
        const grossAmount = updatedAssignment.overriddenPay ?? baseRate;

        const deductionRules = await tx.select().from(deductionRulesTable).where(eq(deductionRulesTable.eventId, event.id));
        const appliedRules = deductionRules.filter((rule: any) => {
          if (rule.triggerType === "always") return true;
          if (rule.triggerType === "late_arrival") return (updatedAssignment.lateArrivalMinutes || 0) > (rule.thresholdMinutes || 0);
          if (rule.triggerType === "early_leave") return (updatedAssignment.earlyLeaveMinutes || 0) > (rule.thresholdMinutes || 0);
          return false;
        });

        const manualDeductions = await tx.select().from(assignmentDeductionsTable).where(eq(assignmentDeductionsTable.eventAssignmentId, updatedAssignment.id));
        
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
            await tx.insert(balanceTransactionsTable).values({
              usherId: updatedAssignment.usherId,
              eventAssignmentId: updatedAssignment.id,
              amount: finalAmount,
              type: "credit",
              reason: `Completed event: ${event.title} (Auto checkout)${deductionSummary}`
            });
            await tx.update(ushersTable).set({ balance: sql`COALESCE(${ushersTable.balance}, 0) + ${finalAmount}` }).where(eq(ushersTable.id, updatedAssignment.usherId));
          }
        }
      }
    }

    // 2. Mark event as completed
    await tx.update(eventsTable).set({ status: "completed" }).where(eq(eventsTable.id, event.id));
  });
  logger.info(`Completed event ${event.id} automatically`);
}
