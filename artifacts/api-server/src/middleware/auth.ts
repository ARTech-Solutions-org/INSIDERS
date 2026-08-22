import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "../lib/auth.js";
import { db, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireUsher(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.type !== "usher") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.type !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, async () => {
    if (req.user?.type !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    try {
      const [admin] = await db.select({ role: adminsTable.role }).from(adminsTable).where(eq(adminsTable.id, req.user.id));
      if (!admin || admin.role !== "super_admin") {
        res.status(403).json({ error: "Forbidden: Super Admin access required" });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
