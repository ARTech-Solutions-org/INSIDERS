import { db, auditLogTable } from "@workspace/db";

export async function audit(
  adminId: number | null,
  actionType: string,
  targetTable: string,
  targetId: number | null,
  details?: string,
) {
  try {
    await db.insert(auditLogTable).values({ adminId, actionType, targetTable, targetId: targetId ?? undefined, details });
  } catch (_) {
    // non-fatal
  }
}
