import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { usageRecords, agents } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireOrgRole } from "@/lib/auth/require-org-role";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const searchParams = req.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions = [eq(usageRecords.orgId, orgId)];
  if (from) conditions.push(gte(usageRecords.createdAt, new Date(from)));
  if (to) conditions.push(lte(usageRecords.createdAt, new Date(to)));

  const where = and(...conditions);

  const rows = await db
    .select({
      agentId: usageRecords.agentId,
      agentName: agents.name,
      totalCost: sql<number>`coalesce(sum(${usageRecords.costUSD}), 0)`,
      totalInputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
      recordCount: sql<number>`count(*)`,
    })
    .from(usageRecords)
    .leftJoin(agents, eq(usageRecords.agentId, agents.id))
    .where(where)
    .groupBy(usageRecords.agentId, agents.name);

  return Response.json(rows);
}
