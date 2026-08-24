import { db, auditLogTable } from "@workspace/db";
import { Request } from "express";

export async function audit(
  req: Request | number | null,
  actionType: string,
  targetTable: string,
  targetId: number | null,
  detailsObj?: string | Record<string, any>,
  targetName?: string
) {
  try {
    let adminId: number | null = null;
    let userAgent: string | null = null;

    if (req && typeof req === 'object' && 'user' in req) {
      adminId = (req.user as any)?.id || null;
      userAgent = req.get('User-Agent') || null;
    } else if (typeof req === 'number') {
      adminId = req;
    }

    let detailsStr: string | null = null;
    if (typeof detailsObj === 'string') {
      detailsStr = JSON.stringify({ message: detailsObj });
    } else if (detailsObj) {
      detailsStr = JSON.stringify(detailsObj);
    }

    await db.insert(auditLogTable).values({
      adminId,
      actionType,
      targetTable,
      targetId: targetId ?? undefined,
      targetName: targetName ?? undefined,
      userAgent,
      details: detailsStr,
    });
  } catch (_) {
    // non-fatal
  }
}
