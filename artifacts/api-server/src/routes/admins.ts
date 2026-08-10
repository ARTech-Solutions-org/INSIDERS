import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, adminsTable, broadcastMessagesTable, auditLogTable, usherDocumentsTable, ushersTable, notificationsTable, eventsTable, eventAssignmentsTable, ratingsTable } from "@workspace/db";
import { eq, lte, and, desc, gte, sql, lt, inArray } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";
import { CreateAdminBody, UpdateAdminBody, SendBroadcastBody } from "@workspace/api-zod";

const router = Router();

// GET /admins
router.get("/admins", requireAdmin, async (req, res) => {
  const admins = await db.select({ id: adminsTable.id, name: adminsTable.name, email: adminsTable.email, role: adminsTable.role, createdByAdminId: adminsTable.createdByAdminId, createdAt: adminsTable.createdAt }).from(adminsTable);
  res.json(admins);
});

// POST /admins
router.post("/admins", requireAdmin, async (req, res) => {
  const parsed = CreateAdminBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { name, email, password, role } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [admin] = await db.insert(adminsTable).values({ name, email, passwordHash, role, createdByAdminId: req.user!.id }).returning();
    await audit(req.user!.id, "CREATE_ADMIN", "admins", admin.id);
    const { passwordHash: _ph, ...safe } = admin;
    res.status(201).json(safe);
  } catch (e: any) {
    if (e?.code === "23505") { res.status(400).json({ error: "Email already in use" }); return; }
    throw e;
  }
});

// PATCH /admins/:id
router.patch("/admins/:id", requireAdmin, async (req, res) => {
  const parsed = UpdateAdminBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const adminId = parseInt(req.params.id as string, 10);
  const [admin] = await db.update(adminsTable).set(parsed.data).where(eq(adminsTable.id, adminId)).returning();
  if (!admin) { res.status(404).json({ error: "Not found" }); return; }
  await audit(req.user!.id, "UPDATE_ADMIN", "admins", admin.id);
  const { passwordHash: _ph, ...safe } = admin;
  res.status(200).json(safe);
});

// DELETE /admins/:id
router.delete("/admins/:id", requireAdmin, async (req, res) => {
  const adminId = parseInt(req.params.id as string, 10);
  await db.delete(adminsTable).where(eq(adminsTable.id, adminId));
  await audit(req.user!.id, "DELETE_ADMIN", "admins", adminId);
  res.status(204).send();
});

// GET /broadcasts
router.get("/broadcasts", requireAdmin, async (req, res) => {
  const broadcasts = await db.select().from(broadcastMessagesTable).orderBy(desc(broadcastMessagesTable.sentAt));
  res.json(broadcasts);
});

// POST /broadcasts
router.post("/broadcasts", requireAdmin, async (req, res) => {
  const parsed = SendBroadcastBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [broadcast] = await db.insert(broadcastMessagesTable).values({ ...parsed.data, sentByAdminId: req.user!.id }).returning();
  // Create notifications for all active ushers
  const ushers = await db.select({ id: ushersTable.id }).from(ushersTable).where(eq(ushersTable.status, "active"));
  if (ushers.length) {
    await db.insert(notificationsTable).values(ushers.map(u => ({ recipientType: "usher", recipientId: u.id, type: "broadcast", message: parsed.data.message })));
  }
  await audit(req.user!.id, "SEND_BROADCAST", "broadcast_messages", broadcast.id);
  res.status(201).json(broadcast);
});

// GET /audit-log
router.get("/audit-log", requireAdmin, async (req, res) => {
  const { adminId, actionType, from, to, page = "1", limit = "50" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const rows = await db.select({ id: auditLogTable.id, adminId: auditLogTable.adminId, actionType: auditLogTable.actionType, targetTable: auditLogTable.targetTable, targetId: auditLogTable.targetId, details: auditLogTable.details, createdAt: auditLogTable.createdAt, adminName: adminsTable.name }).from(auditLogTable).leftJoin(adminsTable, eq(auditLogTable.adminId, adminsTable.id)).orderBy(desc(auditLogTable.createdAt)).limit(parseInt(limit)).offset(offset);
  res.json(rows);
});

// GET /admin/expiring-documents
router.get("/admin/expiring-documents", requireAdmin, async (req, res) => {
  const { days = "30" } = req.query as Record<string, string>;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + parseInt(days));
  const rows = await db.select({ id: usherDocumentsTable.id, usherId: usherDocumentsTable.usherId, docType: usherDocumentsTable.docType, fileUrl: usherDocumentsTable.fileUrl, expiryDate: usherDocumentsTable.expiryDate, status: usherDocumentsTable.status, usherName: ushersTable.fullName }).from(usherDocumentsTable).innerJoin(ushersTable, eq(usherDocumentsTable.usherId, ushersTable.id)).where(and(sql`${usherDocumentsTable.expiryDate} IS NOT NULL`, lte(usherDocumentsTable.expiryDate, cutoff.toISOString().split("T")[0])));
  const today = new Date().toISOString().split("T")[0];
  const result = rows.map(r => ({ ...r, daysUntilExpiry: r.expiryDate ? Math.floor((new Date(r.expiryDate).getTime() - new Date(today).getTime()) / 86400000) : 0 }));
  res.json(result);
});

// GET /admin/dashboard
router.get("/admin/dashboard", requireAdmin, async (req, res) => {
  const [{ active }] = await db.select({ active: sql<number>`count(*)::int` }).from(ushersTable).where(eq(ushersTable.status, "active"));
  const [{ pending }] = await db.select({ pending: sql<number>`count(*)::int` }).from(ushersTable).where(eq(ushersTable.status, "pending"));
  const now = new Date();
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
  const [{ upcoming }] = await db.select({ upcoming: sql<number>`count(*)::int` }).from(eventsTable).where(and(gte(eventsTable.startTime, now), lte(eventsTable.startTime, weekEnd)));
  const [{ balanceOwed }] = await db.select({ balanceOwed: sql<number>`coalesce(sum(balance), 0)::float` }).from(ushersTable).where(gte(ushersTable.balance, 0));
  const recentActivity = await db.select({ id: auditLogTable.id, adminId: auditLogTable.adminId, actionType: auditLogTable.actionType, targetTable: auditLogTable.targetTable, targetId: auditLogTable.targetId, details: auditLogTable.details, createdAt: auditLogTable.createdAt, adminName: adminsTable.name }).from(auditLogTable).leftJoin(adminsTable, eq(auditLogTable.adminId, adminsTable.id)).orderBy(desc(auditLogTable.createdAt)).limit(10);
  // last 6 months event trends
  const eventTrends: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)::int` }).from(eventsTable).where(and(gte(eventsTable.startTime, monthStart), lte(eventsTable.startTime, monthEnd)));
    const [{ done }] = await db.select({ done: sql<number>`count(*)::int` }).from(eventsTable).where(and(gte(eventsTable.startTime, monthStart), lte(eventsTable.startTime, monthEnd), eq(eventsTable.status, "completed")));
    eventTrends.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, eventCount: cnt, completedCount: done });
  }
  res.json({ totalActiveUshers: active, pendingApprovals: pending, upcomingEventsThisWeek: upcoming, totalBalanceOwed: balanceOwed, recentActivity, eventTrends });
});

// GET /admin/usher-stats/:id
router.get("/admin/usher-stats/:id", requireAdmin, async (req, res) => {
  const usherId = parseInt(req.params.id as string, 10);
  const [usher] = await db.select().from(ushersTable).where(eq(ushersTable.id, usherId));
  if (!usher) { res.status(404).json({ error: "Not found" }); return; }

  const assignments = await db.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.usherId, usherId));
  const jobsCompleted = assignments.filter(a => a.status === "completed").length;
  const cancelCount = assignments.filter(a => a.status === "cancelled" || a.status === "declined").length;
  const noShowCount = assignments.filter(a => a.status === "no_show").length;

  // Compute avg rating from ratings table
  const assignmentIds = assignments.map(a => a.id);
  let avgRating = usher.avgRating ?? 0;
  let ratingCount = 0;
  if (assignmentIds.length) {
    const ratings = await db.select({ ratingValue: ratingsTable.ratingValue }).from(ratingsTable).where(inArray(ratingsTable.eventAssignmentId, assignmentIds));
    ratingCount = ratings.length;
    if (ratingCount > 0) avgRating = ratings.reduce((s, r) => s + r.ratingValue, 0) / ratingCount;
  }

  // Total earned from balance transactions
  const [{ totalEarned }] = await db.select({ totalEarned: sql<number>`coalesce(sum(amount), 0)::float` }).from(sql`balance_transactions`).where(sql`usher_id = ${usherId} AND type = 'credit'`);

  res.json({ jobsCompleted, avgRating, cancelCount, noShowCount, totalEarned: totalEarned ?? 0, ratingCount, totalAssigned: assignments.length });
});

// GET /admin/event-stats/:id
router.get("/admin/event-stats/:id", requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id as string, 10);
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event) { res.status(404).json({ error: "Not found" }); return; }

  const assignments = await db.select().from(eventAssignmentsTable).where(eq(eventAssignmentsTable.eventId, eventId));
  const totalAssigned = assignments.length;
  const completedCount = assignments.filter(a => a.status === "completed" || a.status === "checked_in").length;
  const cancelledCount = assignments.filter(a => a.status === "cancelled" || a.status === "declined").length;
  const noShowCount = assignments.filter(a => a.status === "no_show").length;
  const attendanceRate = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

  // Punctuality: how many checked in within 10 minutes of event start
  const eventStart = new Date(event.startTime).getTime();
  const onTimePunches = assignments.filter(a => {
    if (!a.checkinTime) return false;
    const diff = (new Date(a.checkinTime).getTime() - eventStart) / 60000; // minutes late
    return diff <= 10;
  });
  const punctualityRate = completedCount > 0 ? Math.round((onTimePunches.length / completedCount) * 100) : 0;

  res.json({ attendanceRate, punctualityRate, completedCount, cancelledCount, noShowCount, totalAssigned });
});

// GET /coordinator/today
router.get("/coordinator/today", requireAdmin, async (req, res) => {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const events = await db.select().from(eventsTable).where(and(gte(eventsTable.startTime, todayStart), lte(eventsTable.startTime, todayEnd)));
  const result = await Promise.all(events.map(async e => ({ ...e, assignments: await db.select().from(ushersTable).innerJoin(adminsTable, eq(ushersTable.id, 0)).limit(0) })));
  res.json(events);
});

export default router;
