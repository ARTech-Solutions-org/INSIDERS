import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, ushersTable, usherDocumentsTable, usherSkillsTable, usherAvailabilityTable, notificationsTable } from "@workspace/db";
import { eq, and, ilike, or, gte, lte, sql } from "drizzle-orm";
import { requireUsher, requireAdmin } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";
import { sendPushToUsher } from "../lib/fcm.js";
import {
  UpdateMyUsherProfileBody,
  UpdateUsherStatusBody,
  AddMyDocumentBody,
  AddMySkillBody,
  SetMyAvailabilityBody,
} from "@workspace/api-zod";

const router = Router();

// GET /ushers - admin list
router.get("/ushers", requireAdmin, async (req, res) => {
  const { status, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let query = db.select().from(ushersTable).$dynamic();
  const conditions = [];
  if (status) conditions.push(eq(ushersTable.status, status));
  if (search) conditions.push(or(ilike(ushersTable.fullName, `%${search}%`), ilike(ushersTable.email, `%${search}%`), ilike(ushersTable.phone, `%${search}%`))!);
  if (conditions.length) query = query.where(and(...conditions));
  const data = await query.limit(parseInt(limit)).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(ushersTable);
  res.json({ data: data.map(({ passwordHash: _ph, ...u }) => u), total: count });
});

// GET /ushers/export - admin export to CSV
router.get("/ushers/export", requireAdmin, async (req, res) => {
  const { status, search } = req.query as Record<string, string>;
  let query = db.select().from(ushersTable).$dynamic();
  
  const conditions = [];
  if (status) conditions.push(eq(ushersTable.status, status));
  if (search) conditions.push(or(ilike(ushersTable.fullName, `%${search}%`), ilike(ushersTable.email, `%${search}%`), ilike(ushersTable.phone, `%${search}%`))!);
  
  if (conditions.length) query = query.where(and(...conditions));
  
  const data = await query;
  
  const header = ["ID", "Name", "Email", "Phone", "National ID", "Status", "Joined"];
  const rows = data.map(u => {
    return [
      u.id,
      `"${(u.fullName || '').replace(/"/g, '""')}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      `"${(u.phone || '').replace(/"/g, '""')}"`,
      `"${(u.nationalIdNumber || '').replace(/"/g, '""')}"`,
      u.status || 'pending',
      new Date(u.createdAt).toISOString().split('T')[0]
    ].join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ushers.csv"');
  res.send('\uFEFF' + csv); // Add BOM for Excel UTF-8 support
});

// GET /ushers/me
router.get("/ushers/me", requireUsher, async (req, res) => {
  const [usher] = await db.select().from(ushersTable).where(eq(ushersTable.id, req.user!.id));
  if (!usher) { res.status(404).json({ error: "Not found" }); return; }
  const { passwordHash: _ph, ...safe } = usher;
  res.json(safe);
});

// PATCH /ushers/me
router.patch("/ushers/me", requireUsher, async (req, res) => {
  const parsed = UpdateMyUsherProfileBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [usher] = await db.update(ushersTable).set(parsed.data).where(eq(ushersTable.id, req.user!.id)).returning();
  const { passwordHash: _ph, ...safe } = usher;
  res.json(safe);
});

// GET /ushers/:id - admin
router.get("/ushers/:id", requireAdmin, async (req, res) => {
  const usherId = parseInt(req.params.id as string, 10);
  const [usher] = await db.select().from(ushersTable).where(eq(ushersTable.id, usherId));
  if (!usher) { res.status(404).json({ error: "Not found" }); return; }
  const { passwordHash: _ph, ...safe } = usher;
  res.json(safe);
});

// PATCH /ushers/:id/status - admin
router.patch("/ushers/:id/status", requireAdmin, async (req, res) => {
  const parsed = UpdateUsherStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const usherId = parseInt(req.params.id as string, 10);
  const [usher] = await db.update(ushersTable).set({ status: parsed.data.status }).where(eq(ushersTable.id, usherId)).returning();
  if (!usher) { res.status(404).json({ error: "Not found" }); return; }
  await audit(req.user!.id, "UPDATE_STATUS", "ushers", usher.id, `status=${parsed.data.status}`);
  
  if (parsed.data.status === 'active') {
    const title = "Account Approved!";
    const body = "Congratulations, your usher account has been approved.";
    await db.insert(notificationsTable).values({
      recipientType: "usher",
      recipientId: usher.id,
      type: "status_update",
      message: body,
    });
    await sendPushToUsher(usher.id, { title, body, data: { url: "/profile" } });
  } else if (parsed.data.status === 'declined') {
    const title = "Account Declined";
    const body = "We're sorry, but your usher account application has been declined.";
    await db.insert(notificationsTable).values({
      recipientType: "usher",
      recipientId: usher.id,
      type: "status_update",
      message: body,
    });
    await sendPushToUsher(usher.id, { title, body });
  }

  const { passwordHash: _ph, ...safe } = usher;
  res.json(safe);
});

// GET /ushers/me/documents
router.get("/ushers/me/documents", requireUsher, async (req, res) => {
  const docs = await db.select().from(usherDocumentsTable).where(eq(usherDocumentsTable.usherId, req.user!.id));
  res.json(docs);
});

// POST /ushers/me/documents
router.post("/ushers/me/documents", requireUsher, async (req, res) => {
  const parsed = AddMyDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [doc] = await db.insert(usherDocumentsTable).values({ ...parsed.data, usherId: req.user!.id, status: "pending" }).returning();
  res.status(201).json(doc);
});

// GET /ushers/:id/documents - admin
router.get("/ushers/:id/documents", requireAdmin, async (req, res) => {
  const usherId = parseInt(req.params.id as string, 10);
  const docs = await db.select().from(usherDocumentsTable).where(eq(usherDocumentsTable.usherId, usherId));
  res.json(docs);
});

// GET /ushers/me/skills
router.get("/ushers/me/skills", requireUsher, async (req, res) => {
  const skills = await db.select().from(usherSkillsTable).where(eq(usherSkillsTable.usherId, req.user!.id));
  res.json(skills);
});

// POST /ushers/me/skills
router.post("/ushers/me/skills", requireUsher, async (req, res) => {
  const parsed = AddMySkillBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [skill] = await db.insert(usherSkillsTable).values({ ...parsed.data, usherId: req.user!.id }).returning();
  res.status(201).json(skill);
});

// DELETE /ushers/me/skills/:skillId
router.delete("/ushers/me/skills/:skillId", requireUsher, async (req, res) => {
  const skillId = parseInt(req.params.skillId as string, 10);
  await db.delete(usherSkillsTable).where(and(eq(usherSkillsTable.id, skillId), eq(usherSkillsTable.usherId, req.user!.id)));
  res.status(204).send();
});

// GET /ushers/me/availability
router.get("/ushers/me/availability", requireUsher, async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  let query = db.select().from(usherAvailabilityTable).where(eq(usherAvailabilityTable.usherId, req.user!.id)).$dynamic();
  if (from) query = query.where(and(eq(usherAvailabilityTable.usherId, req.user!.id), gte(usherAvailabilityTable.date, from)));
  if (to) query = query.where(and(eq(usherAvailabilityTable.usherId, req.user!.id), lte(usherAvailabilityTable.date, to)));
  res.json(await query);
});

// POST /ushers/me/availability
router.post("/ushers/me/availability", requireUsher, async (req, res) => {
  const parsed = SetMyAvailabilityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const dateStr = typeof parsed.data.date === "string" ? parsed.data.date : new Date(parsed.data.date).toISOString().split("T")[0];
  
  const existing = await db.select().from(usherAvailabilityTable).where(
    and(
      eq(usherAvailabilityTable.usherId, req.user!.id),
      eq(usherAvailabilityTable.date, dateStr)
    )
  );

  const overlaps = existing.some(av => 
    parsed.data.startTime < av.endTime && av.startTime < parsed.data.endTime
  );

  if (overlaps) {
    res.status(400).json({ error: { formErrors: ["Time slot overlaps with existing unavailability"], fieldErrors: {} } });
    return;
  }

  const [av] = await db.insert(usherAvailabilityTable).values({ 
    usherId: req.user!.id, 
    date: dateStr, 
    startTime: parsed.data.startTime, 
    endTime: parsed.data.endTime 
  }).returning();
  res.json(av);
});

// DELETE /ushers/me/availability/:id
router.delete("/ushers/me/availability/:id", requireUsher, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const existing = await db.select().from(usherAvailabilityTable).where(and(eq(usherAvailabilityTable.id, id), eq(usherAvailabilityTable.usherId, req.user!.id)));
  if (!existing.length) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(usherAvailabilityTable).where(eq(usherAvailabilityTable.id, id));
  res.json({ success: true });
});

// PATCH /ushers/:id/documents/:docId/status
router.patch("/ushers/:id/documents/:docId/status", requireAdmin, async (req, res) => {
  const usherId = parseInt(req.params.id as string, 10);
  const docId = parseInt(req.params.docId as string, 10);
  const { status } = req.body;
  
  if (isNaN(usherId) || isNaN(docId)) { res.status(400).json({ error: "Invalid IDs" }); return; }
  if (!["pending", "approved", "rejected"].includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

  const existing = await db.select().from(usherDocumentsTable).where(and(eq(usherDocumentsTable.id, docId), eq(usherDocumentsTable.usherId, usherId)));
  if (!existing.length) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.update(usherDocumentsTable).set({ status }).where(eq(usherDocumentsTable.id, docId)).returning();
  
  audit(req.user!.id, "UPDATE_DOCUMENT_STATUS", `Admin updated document ${docId} status to ${status}`, req.ip);
  res.json(updated);
});

export default router;
