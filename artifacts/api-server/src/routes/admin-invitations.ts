import { Router } from "express";
import { db, adminInvitationsTable, adminsTable } from "@workspace/db";
import { requireSuperAdmin } from "../middleware/auth.js";
import { eq, isNull } from "drizzle-orm";
import crypto from "crypto";
import { audit } from "../lib/audit.js";

const router = Router();

router.post("/admin-invitations", requireSuperAdmin, async (req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  
  const [invitation] = await db.insert(adminInvitationsTable).values({
    token,
    createdByAdminId: req.user!.id,
  }).returning();

  await audit(req, "CREATE_ADMIN_INVITATION", "admin_invitations", invitation.id);

  const baseUrl = process.env.CORS_ORIGIN_ADMIN || "http://localhost:5174";
  const link = `${baseUrl}/register-admin?token=${token}`;
  
  res.status(201).json({ link, token });
});

router.get("/admin-invitations/verify", async (req, res) => {
  const token = req.query.token as string;
  if (!token) {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const [invitation] = await db.select().from(adminInvitationsTable).where(eq(adminInvitationsTable.token, token));
  
  if (!invitation || invitation.usedAt) {
    res.status(404).json({ error: "Token invalid or already used" });
    return;
  }

  res.json({ valid: true });
});

export default router;
