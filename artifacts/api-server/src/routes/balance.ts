import { Router } from "express";
import { db, ushersTable, balanceTransactionsTable, payoutsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireUsher, requireAdmin, requireSuperAdmin } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";
import { sendPushToUsher } from "../lib/fcm.js";
import { CreateTransactionBody, CreatePayoutBody, UpdatePayoutStatusBody, RequestMyPayoutBody } from "@workspace/api-zod";

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

// POST /my/payouts
router.post("/my/payouts", requireUsher, async (req, res) => {
  const parsed = RequestMyPayoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  
  const [usher] = await db.select().from(ushersTable).where(eq(ushersTable.id, req.user!.id));
  
  if (!usher.paymentMethod) {
    res.status(400).json({ error: "Please configure a payment method in your profile before requesting a payout." });
    return;
  }

  if (parsed.data.amount <= 0 || parsed.data.amount > (usher.balance ?? 0)) {
    res.status(400).json({ error: "Invalid payout amount. Must be greater than 0 and less than or equal to your current balance." });
    return;
  }

  const [payout] = await db.insert(payoutsTable).values({
    usherId: usher.id,
    amount: parsed.data.amount,
    method: usher.paymentMethod,
    status: "pending"
  }).returning();

  // Deduct balance and create transaction
  await db.update(ushersTable).set({
    balance: sql`${ushersTable.balance} - ${parsed.data.amount}`
  }).where(eq(ushersTable.id, usher.id));

  await db.insert(balanceTransactionsTable).values({
    usherId: usher.id,
    amount: parsed.data.amount,
    type: "debit",
    reason: `Payout requested via ${usher.paymentMethod}`,
  });

  await audit(req.user!.id, "REQUEST_PAYOUT", "payouts", payout.id);

  await sendPushToUsher(usher.id, {
    title: "Payout Requested",
    body: `Your request for EGP ${parsed.data.amount} has been received and is pending approval.`,
    data: { type: "payout_requested", amount: parsed.data.amount.toString() }
  }).catch(e => console.error("[FCM Error]", e));

  res.status(201).json(payout);
});

// GET /admin/transactions
router.get("/admin/transactions", requireSuperAdmin, async (req, res) => {
  const { usherId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let query = db.select().from(balanceTransactionsTable).$dynamic().orderBy(desc(balanceTransactionsTable.createdAt));
  if (usherId) query = query.where(eq(balanceTransactionsTable.usherId, parseInt(usherId)));
  res.json(await query.limit(parseInt(limit)).offset(offset));
});

// POST /admin/transactions
router.post("/admin/transactions", requireSuperAdmin, async (req, res) => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { usherId, amount, type, reason, eventAssignmentId } = parsed.data;
  const [txn] = await db.insert(balanceTransactionsTable).values({ usherId, amount, type, reason: reason ?? null, eventAssignmentId: eventAssignmentId ?? null }).returning();
  // Update usher balance
  await db.update(ushersTable).set({ 
    balance: sql`${ushersTable.balance} + ${type === "debit" ? (0 - amount) : amount}` 
  }).where(eq(ushersTable.id, usherId));
  await audit(req.user!.id, "CREATE_TRANSACTION", "balance_transactions", txn.id);

  const title = type === "debit" ? "Balance Deduction" : "Balance Added";
  const body = type === "debit" 
    ? `EGP ${amount} has been deducted from your balance. Reason: ${reason}`
    : `EGP ${amount} has been added to your balance. Reason: ${reason}`;
  
  await sendPushToUsher(usherId, {
    title, 
    body, 
    data: { type: "balance_transaction", amount: amount.toString() }
  }).catch(e => console.error("[FCM Error]", e));

  res.status(201).json(txn);
});

// GET /admin/payouts
router.get("/admin/payouts", requireSuperAdmin, async (req, res) => {
  const { status, usherId } = req.query as Record<string, string>;
  let query = db.select({
    id: payoutsTable.id,
    usherId: payoutsTable.usherId,
    amount: payoutsTable.amount,
    method: payoutsTable.method,
    status: payoutsTable.status,
    paidAt: payoutsTable.paidAt,
    usher: {
      id: ushersTable.id,
      fullName: ushersTable.fullName,
      paymentMethodDetails: ushersTable.paymentMethodDetails
    }
  }).from(payoutsTable).leftJoin(ushersTable, eq(payoutsTable.usherId, ushersTable.id)).$dynamic().orderBy(desc(payoutsTable.id));
  if (status) query = query.where(eq(payoutsTable.status, status));
  if (usherId) query = query.where(and(eq(payoutsTable.usherId, parseInt(usherId))));
  res.json(await query);
});

// POST /admin/payouts
router.post("/admin/payouts", requireSuperAdmin, async (req, res) => {
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

  await sendPushToUsher(parsed.data.usherId, {
    title: "Payout Initiated",
    body: `A payout of EGP ${parsed.data.amount} has been initiated via ${parsed.data.method}.`,
    data: { type: "payout_initiated", amount: parsed.data.amount.toString() }
  }).catch(e => console.error("[FCM Error]", e));

  res.status(201).json(payout);
});

// PATCH /admin/payouts/:id/status
router.patch("/admin/payouts/:id/status", requireSuperAdmin, async (req, res) => {
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

  if (parsed.data.status === "paid" && existing.status !== "paid") {
    await sendPushToUsher(existing.usherId, {
      title: "Payout Completed \uD83D\uDCB0",
      body: `Your payout of EGP ${existing.amount} has been completed!`,
      data: { type: "payout_completed", amount: existing.amount.toString() }
    }).catch(e => console.error("[FCM Error]", e));
  } else if (parsed.data.status === "cancelled" && existing.status !== "cancelled") {
    await sendPushToUsher(existing.usherId, {
      title: "Payout Cancelled",
      body: `Your payout of EGP ${existing.amount} was cancelled. The amount has been refunded to your balance.`,
      data: { type: "payout_cancelled", amount: existing.amount.toString() }
    }).catch(e => console.error("[FCM Error]", e));
  }

  res.json(payout);
});

export default router;
