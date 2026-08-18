import { Router } from "express";
import { db, usherPushTokensTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireUsher } from "../middleware/auth.js";

const router = Router();

/**
 * POST /my/push-token
 * Registers (upserts) an FCM token for the currently logged-in usher.
 * Body: { token: string }
 */
router.post("/my/push-token", requireUsher, async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token is required" });
    return;
  }

  const usherId = req.user!.id;

  // Upsert – if the (usherId, token) pair already exists, do nothing
  await db
    .insert(usherPushTokensTable)
    .values({ usherId, token })
    .onConflictDoNothing();

  res.json({ ok: true });
});

/**
 * DELETE /my/push-token
 * Removes a specific FCM token (called on logout so the device stops receiving pushes).
 * Body: { token: string }
 */
router.delete("/my/push-token", requireUsher, async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token is required" });
    return;
  }

  const usherId = req.user!.id;
  await db
    .delete(usherPushTokensTable)
    .where(and(eq(usherPushTokensTable.usherId, usherId), eq(usherPushTokensTable.token, token)));

  res.json({ ok: true });
});

export default router;
