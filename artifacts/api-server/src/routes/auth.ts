import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, ushersTable, adminsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signToken, verifyToken } from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";
import {
  RegisterUsherBody,
  LoginUsherBody,
  LoginAdminBody,
} from "@workspace/api-zod";

const router = Router();

// POST /auth/usher/register
router.post("/auth/usher/register", async (req, res) => {
  const parsed = RegisterUsherBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { fullName, phone, email, nationalIdNumber, password, nationalIdDocUrl, profilePhotoUrl } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [usher] = await db.insert(ushersTable).values({
      fullName, phone, email, nationalIdNumber, passwordHash,
      nationalIdDocUrl: nationalIdDocUrl ?? null,
      profilePhotoUrl: profilePhotoUrl ?? null,
      status: "pending",
    }).returning();
    const token = signToken({ type: "usher", id: usher.id });
    res.status(201).json({ token, usher });
  } catch (e: any) {
    const isDuplicateError = e?.code === "23505" || 
                           e?.cause?.code === "23505" || 
                           (e?.message && (e.message.includes("duplicate key") || e.message.includes("unique constraint") || e.message.includes("23505")));

    if (isDuplicateError) {
      const [existing] = await db.select().from(ushersTable).where(
        or(
          eq(ushersTable.email, email),
          eq(ushersTable.phone, phone),
          eq(ushersTable.nationalIdNumber, nationalIdNumber)
        )
      );

      if (existing) {
        if (existing.status === "pending") {
          res.status(400).json({ error: "An account with these details is already registered and is currently under review." });
        } else if (existing.status === "active") {
          res.status(400).json({ error: "An account with these details is already active. Please log in." });
        } else {
          res.status(400).json({ error: "An account with these details already exists." });
        }
        return;
      }

      res.status(400).json({ error: "Email, phone, or national ID already registered" });
      return;
    }
    throw e;
  }
});

// POST /auth/usher/login
router.post("/auth/usher/login", async (req, res) => {
  console.log("[DEBUG USHER LOGIN] Received login request body:", req.body);
  const parsed = LoginUsherBody.safeParse(req.body);
  if (!parsed.success) {
    console.log("[DEBUG USHER LOGIN] Zod parse failure:", parsed.error.flatten());
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const cleanEmail = email.trim().toLowerCase();
  const ushers = await db.select().from(ushersTable);
  console.log("[DEBUG USHER LOGIN] Total ushers in DB:", ushers.length, "| Emails:", ushers.map(u => u.email));
  const usher = ushers.find(u => u.email?.trim().toLowerCase() === cleanEmail);
  if (!usher) {
    console.log("[DEBUG USHER LOGIN] No usher matched email:", cleanEmail);
    res.status(404).json({ error: "This account does not exist" });
    return;
  }
  const isMatch = await bcrypt.compare(password, usher.passwordHash || "");
  console.log("[DEBUG USHER LOGIN] Bcrypt match for password:", isMatch);
  if (!isMatch) {
    console.log("[DEBUG USHER LOGIN] Password mismatch for:", cleanEmail);
    res.status(401).json({ error: "Incorrect password. Please try again." });
    return;
  }
  if (usher.status === "declined") {
    console.log("[DEBUG USHER LOGIN] Usher is declined:", cleanEmail);
    res.status(403).json({ error: "Your application has been declined by the administration." });
    return;
  }

  const token = signToken({ type: "usher", id: usher.id });
  res.json({ token, usher });
});

// POST /auth/admin/login
router.post("/auth/admin/login", async (req, res) => {
  console.log("[DEBUG LOGIN] Received login request body:", req.body);
  const parsed = LoginAdminBody.safeParse(req.body);
  if (!parsed.success) {
    console.log("[DEBUG LOGIN] Zod parse failure:", parsed.error.flatten());
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const cleanEmail = email.trim().toLowerCase();
  const admins = await db.select().from(adminsTable);
  console.log("[DEBUG LOGIN] Found admins in DB:", admins.map(a => ({ id: a.id, email: a.email, role: a.role })));
  const admin = admins.find(a => a.email?.trim().toLowerCase() === cleanEmail);
  if (!admin) {
    console.log("[DEBUG LOGIN] No admin matched email:", cleanEmail);
    res.status(404).json({ error: "This account does not exist" });
    return;
  }
  const isMatch = await bcrypt.compare(password, admin.passwordHash || "");
  console.log("[DEBUG LOGIN] Bcrypt match result for password:", isMatch);
  if (!isMatch) {
    res.status(401).json({ error: "Incorrect password. Please try again." });
    return;
  }
  const { passwordHash: _ph, ...adminSafe } = admin;
  const token = signToken({ type: "admin", id: admin.id });
  res.json({ token, admin: adminSafe });
});

// GET /auth/me
router.get("/auth/me", requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.type === "usher") {
    const [usher] = await db.select().from(ushersTable).where(eq(ushersTable.id, user.id));
    if (!usher) { res.status(401).json({ error: "Not found" }); return; }
    res.json({ type: "usher", id: usher.id, name: usher.fullName, email: usher.email, status: usher.status, role: null });
  } else {
    const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.id, user.id));
    if (!admin) { res.status(401).json({ error: "Not found" }); return; }
    res.json({ type: "admin", id: admin.id, name: admin.name, email: admin.email, role: admin.role, status: null });
  }
});

// POST /auth/logout
router.post("/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

export default router;
