import app from "./app.js";
import { logger } from "./lib/logger.js";
import { db, eventsTable } from "@workspace/db";
import { and, lt, ne } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Background worker to auto-close events whose end time has passed
const autoCloseEvents = async () => {
  try {
    await db
      .update(eventsTable)
      .set({ status: "completed" })
      .where(
        and(
          lt(eventsTable.endTime, new Date()),
          ne(eventsTable.status, "completed")
        )
      );
  } catch (err) {
    logger.error({ err }, "Error auto-closing events");
  }
};

// Run immediately on startup
autoCloseEvents();
// Then run every minute
setInterval(autoCloseEvents, 60 * 1000);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
