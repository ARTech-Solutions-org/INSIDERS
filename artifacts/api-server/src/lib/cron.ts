import { db, eventsTable, eventAssignmentsTable, deductionRulesTable, assignmentDeductionsTable, balanceTransactionsTable, ushersTable, reliabilityEventsTable } from "@workspace/db";
import { eq, lt, inArray, sql, and, ne } from "drizzle-orm";
import { logger } from "./logger.js";
import { processEventCompletion } from "./event-processor.js";

// Complete expired events every 5 minutes
export function startCronJobs() {
  logger.info("Starting background cron jobs");

  setInterval(async () => {
    try {
      await processExpiredEvents();
    } catch (err) {
      logger.error({ err }, "Error in processExpiredEvents cron job");
    }
  }, 5 * 60 * 1000); // 5 minutes
}

async function processExpiredEvents() {
  const now = new Date();
  
  // Find events where endTime < now and status is not completed/cancelled
  const expiredEvents = await db.select()
    .from(eventsTable)
    .where(
      and(
        lt(eventsTable.endTime, now),
        ne(eventsTable.status, "completed"),
        ne(eventsTable.status, "cancelled")
      )
    );

  if (expiredEvents.length === 0) return;

  logger.info(`Found ${expiredEvents.length} expired events to complete`);

  for (const event of expiredEvents) {
    try {
      await processEventCompletion(event.id);
    } catch (err) {
      logger.error({ err, eventId: event.id }, "Failed to auto-complete event");
    }
  }
}
