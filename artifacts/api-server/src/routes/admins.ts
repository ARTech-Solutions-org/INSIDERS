import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, adminsTable, adminInvitationsTable, broadcastMessagesTable, auditLogTable, usherDocumentsTable, ushersTable, notificationsTable, eventsTable, eventAssignmentsTable, ratingsTable, payoutsTable, systemSettingsTable, DEFAULT_RATING_CONFIG } from "@workspace/db";
import { eq, lte, and, desc, gte, sql, lt, inArray, isNull, or } from "drizzle-orm";
import { requireAdmin, requireSuperAdmin } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";
import { CreateAdminBody, UpdateAdminBody, SendBroadcastBody } from "@workspace/api-zod";
import { sendPushToUshers } from "../lib/fcm.js";
import { recalculateAllUsherRatings } from "../lib/auto-rating-engine.js";

const router = Router();

// GET /admins — super_admin only
router.get("/admins", requireSuperAdmin, async (req, res) => {
  const admins = await db.select({ id: adminsTable.id, name: adminsTable.name, email: adminsTable.email, role: adminsTable.role, canManageFinance: adminsTable.canManageFinance, createdByAdminId: adminsTable.createdByAdminId, createdAt: adminsTable.createdAt }).from(adminsTable);
  res.json(admins);
});

// POST /admins — super_admin only
router.post("/admins", requireSuperAdmin, async (req, res) => {
  const parsed = CreateAdminBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { name, email, password, role, canManageFinance } = parsed.data;
  // Only allow valid roles
  if (!["admin", "super_admin"].includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be 'admin' or 'super_admin'." });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [admin] = await db.insert(adminsTable).values({ name, email, passwordHash, role, canManageFinance: canManageFinance ?? false, createdByAdminId: req.user!.id }).returning();
    await audit(req.user!.id, "CREATE_ADMIN", "admins", admin.id);
    const { passwordHash: _ph, ...safe } = admin;
    res.status(201).json(safe);
  } catch (e: any) {
    if (e?.code === "23505") { res.status(400).json({ error: "Email already in use" }); return; }
    throw e;
  }
});

// POST /admins/register - public but requires valid token
router.post("/admins/register", async (req, res) => {
  const { token, name, email, password } = req.body;
  if (!token || !name || !email || !password || password.length < 6) {
    res.status(400).json({ error: "Missing or invalid fields" });
    return;
  }

  const [invitation] = await db.select().from(adminInvitationsTable).where(eq(adminInvitationsTable.token, token));
  if (!invitation || invitation.usedAt) {
    res.status(400).json({ error: "Invalid or used token" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [admin] = await db.insert(adminsTable).values({
      name,
      email,
      passwordHash,
      role: "admin",
      createdByAdminId: invitation.createdByAdminId,
    }).returning();

    // Mark token as used
    await db.update(adminInvitationsTable).set({ usedAt: new Date() }).where(eq(adminInvitationsTable.id, invitation.id));

    await audit(admin.id, "ADMIN_REGISTERED", "admins", admin.id, `Used invitation token ${token.substring(0, 8)}...`);

    const { passwordHash: _ph, ...safe } = admin;
    res.status(201).json(safe);
  } catch (e: any) {
    if (e?.code === "23505") { res.status(400).json({ error: "Email already in use" }); return; }
    throw e;
  }
});

// PATCH /admins/:id — super_admin only
router.patch("/admins/:id", requireSuperAdmin, async (req, res) => {
  const parsed = UpdateAdminBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const adminId = parseInt(req.params.id as string, 10);
  const updateData: any = { ...parsed.data };
  if (typeof parsed.data.canManageFinance !== 'undefined') {
    updateData.canManageFinance = parsed.data.canManageFinance;
  }
  const [admin] = await db.update(adminsTable).set(updateData).where(eq(adminsTable.id, adminId)).returning();
  if (!admin) { res.status(404).json({ error: "Not found" }); return; }
  await audit(req.user!.id, "UPDATE_ADMIN", "admins", admin.id);
  const { passwordHash: _ph, ...safe } = admin;
  res.status(200).json(safe);
});

// DELETE /admins/:id — super_admin only
router.delete("/admins/:id", requireSuperAdmin, async (req, res) => {
  const adminId = parseInt(req.params.id as string, 10);
  await db.delete(adminsTable).where(eq(adminsTable.id, adminId));
  await audit(req.user!.id, "DELETE_ADMIN", "admins", adminId);
  res.status(204).send();
});

import { getFirebaseMessaging } from "../lib/fcm.js";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

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
  // Construct query based on target filter
  let ushersQuery = db.select({ id: ushersTable.id }).from(ushersTable).$dynamic();
  
  switch (parsed.data.targetFilter) {
    case "pending_ushers":
      ushersQuery = ushersQuery.where(eq(ushersTable.status, "pending"));
      break;
    case "suspended_ushers":
      ushersQuery = ushersQuery.where(eq(ushersTable.status, "suspended"));
      break;
    case "rejected_ushers":
      ushersQuery = ushersQuery.where(eq(ushersTable.status, "rejected"));
      break;
    case "male_ushers":
      ushersQuery = ushersQuery.where(and(eq(ushersTable.status, "active"), eq(ushersTable.gender, "Male")));
      break;
    case "female_ushers":
      ushersQuery = ushersQuery.where(and(eq(ushersTable.status, "active"), eq(ushersTable.gender, "Female")));
      break;
    case "high_rating":
      ushersQuery = ushersQuery.where(and(eq(ushersTable.status, "active"), gte(ushersTable.avgRating, 4.5)));
      break;
    case "no_payment_method":
      ushersQuery = ushersQuery.where(and(eq(ushersTable.status, "active"), or(isNull(ushersTable.paymentMethod), eq(ushersTable.paymentMethod, ""))));
      break;
    case "incomplete_profile":
      ushersQuery = ushersQuery.where(
        and(
          eq(ushersTable.status, "active"),
          or(
            isNull(ushersTable.paymentMethod),
            eq(ushersTable.paymentMethod, ""),
            isNull(ushersTable.profilePhotoUrl),
            eq(ushersTable.profilePhotoUrl, ""),
            isNull(ushersTable.nationalIdDocUrl),
            eq(ushersTable.nationalIdDocUrl, ""),
            isNull(ushersTable.gender),
            eq(ushersTable.gender, ""),
            isNull(ushersTable.shoeSize),
            eq(ushersTable.shoeSize, "")
          )
        )
      );
      break;
    case "pending_payouts":
      ushersQuery = ushersQuery
        .leftJoin(payoutsTable, eq(payoutsTable.usherId, ushersTable.id))
        .where(and(eq(ushersTable.status, "active"), eq(payoutsTable.status, "pending")));
      break;
    case "all_ushers":
    default:
      ushersQuery = ushersQuery.where(eq(ushersTable.status, "active"));
      break;
  }

  const ushers = await ushersQuery;
  if (ushers.length) {
    await db.insert(notificationsTable).values(ushers.map(u => ({ recipientType: "usher", recipientId: u.id, type: "broadcast", message: parsed.data.message })));

    // Also send as push notifications to all active ushers
    await sendPushToUshers(ushers.map(u => u.id), {
      title: "Admin Broadcast 📣",
      body: parsed.data.message,
      data: { type: "broadcast" },
    });
  }
  await audit(req.user!.id, "SEND_BROADCAST", "broadcast_messages", broadcast.id);
  res.status(201).json(broadcast);
});

// GET /fcm-debug
router.get("/fcm-debug", async (req, res) => {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      res.json({ error: "FIREBASE_SERVICE_ACCOUNT_JSON is missing from environment variables." });
      return;
    }
    
    // Try to parse it
    let credential;
    try {
      credential = JSON.parse(raw);
      
      // Vercel environment variables often escape \n as literal string "\\n"
      if (credential.private_key && credential.private_key.includes('\\n')) {
        credential.private_key = credential.private_key.replace(/\\n/g, '\n');
      }
    } catch (e: any) {
      res.json({ error: "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.", details: e.message, firstFewChars: raw.substring(0, 15) });
      return;
    }

    // Try to init messaging MANUALLY so we can catch the exact error
    let app;
    try {
      app = getApps().length === 0 ? initializeApp({ credential: cert(credential) }) : getApps()[0];
    } catch (firebaseErr: any) {
      res.json({ error: "Firebase Admin initializeApp failed.", details: firebaseErr.message, stack: firebaseErr.stack });
      return;
    }

    let messaging;
    try {
      messaging = getMessaging(app);
    } catch (msgErr: any) {
      res.json({ error: "Firebase getMessaging failed.", details: msgErr.message, stack: msgErr.stack });
      return;
    }

    res.json({ success: true, message: "Firebase Admin initialized correctly!" });
  } catch (err: any) {
    res.json({ error: "Caught an exception.", details: err.message, stack: err.stack });
  }
});

// GET /audit-log — super_admin only
router.get("/audit-log", requireSuperAdmin, async (req, res) => {
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

// GET /admin/dashboard — any admin; sensitive fields (balanceOwed, recentActivity) stripped for non-super_admin
router.get("/admin/dashboard", requireAdmin, async (req, res) => {
  const [{ active }] = await db.select({ active: sql<number>`count(*)::int` }).from(ushersTable).where(eq(ushersTable.status, "active"));
  const [{ pending }] = await db.select({ pending: sql<number>`count(*)::int` }).from(ushersTable).where(eq(ushersTable.status, "pending"));
  const now = new Date();
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
  const [{ upcoming }] = await db.select({ upcoming: sql<number>`count(*)::int` }).from(eventsTable).where(and(gte(eventsTable.startTime, now), lte(eventsTable.startTime, weekEnd)));
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

  // Check if caller is super_admin to decide whether to include sensitive fields
  const [callerAdmin] = await db.select({ role: adminsTable.role }).from(adminsTable).where(eq(adminsTable.id, req.user!.id));
  const isSuperAdmin = callerAdmin?.role === "super_admin";

  if (isSuperAdmin) {
    const [{ balanceOwed }] = await db.select({ balanceOwed: sql<number>`coalesce(sum(balance), 0)::float` }).from(ushersTable).where(gte(ushersTable.balance, 0));
    const recentActivity = await db.select({ id: auditLogTable.id, adminId: auditLogTable.adminId, actionType: auditLogTable.actionType, targetTable: auditLogTable.targetTable, targetId: auditLogTable.targetId, details: auditLogTable.details, createdAt: auditLogTable.createdAt, adminName: adminsTable.name }).from(auditLogTable).leftJoin(adminsTable, eq(auditLogTable.adminId, adminsTable.id)).orderBy(desc(auditLogTable.createdAt)).limit(10);
    res.json({ totalActiveUshers: active, pendingApprovals: pending, upcomingEventsThisWeek: upcoming, totalBalanceOwed: balanceOwed, recentActivity, eventTrends });
  } else {
    res.json({ totalActiveUshers: active, pendingApprovals: pending, upcomingEventsThisWeek: upcoming, totalBalanceOwed: null, recentActivity: null, eventTrends });
  }
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

// GET /admin/settings/rating — super_admin only
router.get("/admin/settings/rating", requireSuperAdmin, async (req, res) => {
  const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "ratingConfig"));
  res.json(row ? row.value : DEFAULT_RATING_CONFIG);
});

// PUT /admin/settings/rating — super_admin only
router.put("/admin/settings/rating", requireSuperAdmin, async (req, res) => {
  const body = req.body;
  if (typeof body !== "object" || !body) { res.status(400).json({ error: "Invalid body" }); return; }

  // Merge with defaults so we never lose a key
  const merged = { ...DEFAULT_RATING_CONFIG, ...body };

  // Normalize weights to sum to 1
  const totalWeight = (merged.clientRatingWeight || 0) + (merged.punctualityWeight || 0) + (merged.reliabilityWeight || 0);
  if (totalWeight > 0 && Math.abs(totalWeight - 1) > 0.001) {
    merged.clientRatingWeight = parseFloat((merged.clientRatingWeight / totalWeight).toFixed(4));
    merged.punctualityWeight = parseFloat((merged.punctualityWeight / totalWeight).toFixed(4));
    merged.reliabilityWeight = parseFloat((merged.reliabilityWeight / totalWeight).toFixed(4));
  }

  await db.insert(systemSettingsTable).values({
    key: "ratingConfig",
    value: merged,
    updatedAt: new Date(),
    updatedByAdminId: req.user!.id
  }).onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: merged, updatedAt: new Date(), updatedByAdminId: req.user!.id } });

  await audit(req.user!.id, "UPDATE_RATING_CONFIG", "system_settings", 0);

  // Trigger full recalculation in background (fire-and-forget)
  recalculateAllUsherRatings().catch(() => {});

  res.json(merged);
});

export default router;
