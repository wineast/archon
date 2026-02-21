import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/auth/require-org-role";
import { db } from "@/db";
import { orgs, orgCreditTransactions } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { invalidateOrgCreditCache } from "@/lib/credits/queries";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/orgs/[id]/credits
 * Returns balance + transaction history for the org. Requires admin role.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { id: orgId } = await params;

  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const [org] = await db
    .select({ creditBalanceUSD: orgs.creditBalanceUSD })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  if (!org) {
    return Response.json({ error: "Org not found" }, { status: 404 });
  }

  const transactions = await db
    .select()
    .from(orgCreditTransactions)
    .where(eq(orgCreditTransactions.orgId, orgId))
    .orderBy(desc(orgCreditTransactions.createdAt))
    .limit(200);

  return Response.json({
    balance: org.creditBalanceUSD,
    transactions,
  });
}

/**
 * POST /api/orgs/[id]/credits
 * User self-service purchase (pseudo-payment). Requires org admin role.
 * Body: { amount: number }
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { id: orgId } = await params;

  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { amount } = body as { amount: number };

  if (typeof amount !== "number" || amount <= 0) {
    return Response.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  // Atomic update + read back
  const [updated] = await db
    .update(orgs)
    .set({
      creditBalanceUSD: sql`${orgs.creditBalanceUSD} + ${amount}`,
    })
    .where(eq(orgs.id, orgId))
    .returning({ creditBalanceUSD: orgs.creditBalanceUSD });

  if (!updated) {
    return Response.json({ error: "Org not found" }, { status: 404 });
  }

  // Insert transaction record
  await db.insert(orgCreditTransactions).values({
    orgId,
    amount,
    type: "purchase",
    description: `购买 $${amount.toFixed(2)} 额度`,
    createdBy: ctx.user.id,
    balanceAfter: updated.creditBalanceUSD,
  });

  invalidateOrgCreditCache(orgId);

  return Response.json({ balance: updated.creditBalanceUSD });
}
