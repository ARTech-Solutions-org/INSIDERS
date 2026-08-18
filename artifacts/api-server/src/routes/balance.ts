import { Router } from "express";
import { db, ushersTable, balanceTransactionsTable, payoutsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireUsher, requireAdmin } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";
import { CreateTransactionBody, CreatePayoutBody, UpdatePayoutStatusBody } from "@workspace/api-zod";

const router = Router();

// GET /my/balance
router.get("/my/balance", requireUsher, async (req, res) => {
  const [usher] = await db.select().from(ushersTable).where(eq(ushersTable.id, req.user!.id));
  const recentTransactions = await db.select().from(balanceTransactionsTable).where(eq(balanceTransactionsTable.usherId, req.user!.id)).orderBy(desc(balanceTransactionsTable.createdAt)).limit(5);
  res.json({ balance: usher?.balance ?? 0, recentTransactions });
});

// GET /my/transactions
router.get("/my/transactions", requireUsher, async (req, res) => {
  const { page = "1", limit = "20" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const txns = await db.select().from(balanceTransactionsTable).where(eq(balanceTransactionsTable.usherId, req.user!.id)).orderBy(desc(balanceTransactionsTable.createdAt)).limit(parseInt(limit)).offset(offset);
  res.json(txns);
});

// GET /my/payouts
router.get("/my/payouts", requireUsher, async (req, res) => {
  const payouts = await db.select().from(payoutsTable).where(eq(payoutsTable.usherId, req.user!.id)).orderBy(desc(payoutsTable.id));
  res.json(payouts);
});

// GET /admin/transactions
router.get("/admin/transactions", requireAdmin, async (req, res) => {
  const { usherId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let query = db.select().from(balanceTransactionsTable).$dynamic().orderBy(desc(balanceTransactionsTable.createdAt));
  if (usherId) query = query.where(eq(balanceTransactionsTable.usherId, parseInt(usherId)));
  res.json(await query.limit(parseInt(limit)).offset(offset));
});

// POST /admin/transactions
router.post("/admin/transactions", requireAdmin, async (req, res) => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { usherId, amount, type, reason, eventAssignmentId } = parsed.data;
  const [txn] = await db.insert(balanceTransactionsTable).values({ usherId, amount, type, reason: reason ?? null, eventAssignmentId: eventAssignmentId ?? null }).returning();
  // Update usher balance
  await db.update(ushersTable).set({ 
    balance: sql`${ushersTable.balance} + ${type === "debit" ? (0 - amount) : amount}` 
  }).where(eq(ushersTable.id, usherId));
  await audit(req.user!.id, "CREATE_TRANSACTION", "balance_transactions", txn.id);
  res.status(201).json(txn);
});

// GET /admin/payouts
router.get("/admin/payouts", requireAdmin, async (req, res) => {
  const { status, usherId } = req.query as Record<string, string>;
  let query = db.select().from(payoutsTable).$dynamic().orderBy(desc(payoutsTable.id));
  if (status) query = query.where(eq(payoutsTable.status, status));
  if (usherId) query = query.where(and(eq(payoutsTable.usherId, parseInt(usherId))));
  res.json(await query);
});

// POST /admin/payouts
router.post("/admin/payouts", requireAdmin, async (req, res) => {
  const parsed = CreatePayoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [payout] = await db.insert(payoutsTable).values({ ...parsed.data, status: "pending" }).returning();
  
  // Deduct balance and create transaction
  await db.update(ushersTable).set({ 
    balance: sql`${ushersTable.balance} - ${parsed.data.amount}` 
  }).where(eq(ushersTable.id, parsed.data.usherId));

  await db.insert(balanceTransactionsTable).values({
    usherId: parsed.data.usherId,
    amount: parsed.data.amount,
    type: "debit",
    reason: `Payout via ${parsed.data.method}`,
  });

  await audit(req.user!.id, "CREATE_PAYOUT", "payouts", payout.id);
  res.status(201).json(payout);
});

// PATCH /admin/payouts/:id/status
router.patch("/admin/payouts/:id/status", requireAdmin, async (req, res) => {
  const parsed = UpdatePayoutStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const paidAt = parsed.data.status === "paid" ? new Date() : null;
  const payoutId = parseInt(req.params.id as string, 10);
  
  const [existing] = await db.select().from(payoutsTable).where(eq(payoutsTable.id, payoutId));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [payout] = await db.update(payoutsTable).set({ status: parsed.data.status, paidAt: paidAt ?? undefined }).where(eq(payoutsTable.id, payoutId)).returning();
  
  if (parsed.data.status === "cancelled" && existing.status !== "cancelled") {
    // Refund the balance
    await db.update(ushersTable).set({
      balance: sql`${ushersTable.balance} + ${existing.amount}`
    }).where(eq(ushersTable.id, existing.usherId));

    await db.insert(balanceTransactionsTable).values({
      usherId: existing.usherId,
      amount: existing.amount,
      type: "credit",
      reason: "Payout cancelled refund",
    });
  }

  await audit(req.user!.id, "UPDATE_PAYOUT_STATUS", "payouts", payout.id, `status=${parsed.data.status}`);
  res.json(payout);
});

export default router;
