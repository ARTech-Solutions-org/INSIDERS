import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, ushersTable, adminsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signToken, verifyToken } from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { r2Client, R2_BUCKET_NAME } from "../lib/r2.js";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import {
  RegisterUsherBody,
  LoginUsherBody,
  LoginAdminBody,
} from "@workspace/api-zod";
import rateLimit from "express-rate-limit";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again after 15 minutes" },
});

const router = Router();

// POST /uploads/presigned-url
router.post("/uploads/presigned-url", async (req, res) => {
  try {
    const { filename, contentType, type } = req.body;
    if (!filename || !contentType || !type) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    
    const id = crypto.randomUUID();
    // Sanitize filename to avoid weird SignatureDoesNotMatch errors with R2
    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    let key = `uploads/${id}/${safeName}`;
    if (type === 'profilePhoto') key = `profile-photos/${id}.jpg`;
    if (type === 'idDocumentFront') key = `id-documents/${id}/front.jpg`;
    if (type === 'idDocumentBack') key = `id-documents/${id}/back.jpg`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });
    
    const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    res.json({ url, key });
  } catch (error) {
    console.error("Presigned URL error:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// GET /uploads/read
router.get("/uploads/read", async (req, res) => {
  try {
    const key = req.query.key as string;
    if (!key) {
      res.status(400).json({ error: "Missing key" });
      return;
    }
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    res.redirect(url);
  } catch (error) {
    console.error("Failed to read upload:", error);
    res.status(500).json({ error: "Failed to read upload" });
  }
});

// POST /auth/usher/register
router.post("/auth/usher/register", async (req, res) => {
  const parsed = RegisterUsherBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { 
    fullName, phone, email, nationalIdNumber, password, 
    nationalIdDocUrl, nationalIdDocKey,
    nationalIdDocBackUrl, nationalIdDocBackKey,
    profilePhotoUrl, profilePhotoKey,
    paymentMethod, paymentMethodDetails,
    fullNameArabic, gender, dateOfBirth, height, university, major, languages,
    shoeSize, shirtSize, tShirtSize, pantsSize, shortsSize
  } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [usher] = await db.insert(ushersTable).values({
      fullName, phone, email, nationalIdNumber, passwordHash,
      nationalIdDocUrl: nationalIdDocUrl ?? null,
      nationalIdDocKey: nationalIdDocKey ?? null,
      nationalIdDocBackUrl: nationalIdDocBackUrl ?? null,
      nationalIdDocBackKey: nationalIdDocBackKey ?? null,
      profilePhotoUrl: profilePhotoUrl ?? null,
      profilePhotoKey: profilePhotoKey ?? null,
      paymentMethod,
      paymentMethodDetails,
      fullNameArabic: fullNameArabic ?? null,
      gender: gender ?? null,
      dateOfBirth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : null,
      height: height ?? null,
      university: university ?? null,
      major: major ?? null,
      languages: languages ?? null,
      shoeSize: shoeSize ?? null,
      shirtSize: shirtSize ?? null,
      tShirtSize: tShirtSize ?? null,
      pantsSize: pantsSize ?? null,
      shortsSize: shortsSize ?? null,
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
router.post("/auth/usher/login", loginLimiter, async (req, res) => {
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
  const token = signToken({ type: "usher", id: usher.id });
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
  });
  res.json({ token, usher });
});

// POST /auth/admin/login
router.post("/auth/admin/login", loginLimiter, async (req, res) => {
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
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
  });
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
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ ok: true });
});

export default router;
