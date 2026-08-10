import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /my/notifications
router.get("/my/notifications", requireAuth, async (req, res) => {
  const { unread } = req.query as Record<string, string>;
  const user = req.user!;
  let query = db.select().from(notificationsTable).where(and(eq(notificationsTable.recipientType, user.type), eq(notificationsTable.recipientId, user.id))).$dynamic().orderBy(desc(notificationsTable.sentAt));
  if (unread === "true") query = query.where(and(eq(notificationsTable.recipientType, user.type), eq(notificationsTable.recipientId, user.id), eq(notificationsTable.isRead, false)));
  res.json(await query);
});

// POST /my/notifications/read-all
router.post("/my/notifications/read-all", requireAuth, async (req, res) => {
  const user = req.user!;
  await db.update(notificationsTable).set({ isRead: true }).where(and(eq(notificationsTable.recipientType, user.type), eq(notificationsTable.recipientId, user.id)));
  res.json({ ok: true });
});

// POST /my/notifications/:notificationId/read
router.post("/my/notifications/:notificationId/read", requireAuth, async (req, res) => {
  const user = req.user!;
  const notificationId = parseInt(req.params.notificationId as string, 10);
  await db.update(notificationsTable).set({ isRead: true }).where(and(eq(notificationsTable.id, notificationId), eq(notificationsTable.recipientType, user.type), eq(notificationsTable.recipientId, user.id)));
  res.json({ ok: true });
});

export default router;
