import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { usageRecords } from "@/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const searchParams = req.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const source = searchParams.get("source");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50")));

  const conditions = [eq(usageRecords.agentId, agentId)];
  if (from) conditions.push(gte(usageRecords.createdAt, new Date(from)));
  if (to) conditions.push(lte(usageRecords.createdAt, new Date(to)));
  if (source) conditions.push(eq(usageRecords.source, source as "chat" | "embed" | "prompt-assist" | "eval"));

  const where = and(...conditions);

  const [records, countResult] = await Promise.all([
    db
      .select()
      .from(usageRecords)
      .where(where)
      .orderBy(desc(usageRecords.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db
      .select({ total: sql<number>`count(*)` })
      .from(usageRecords)
      .where(where)
      .then((rows) => rows[0]),
  ]);

  return Response.json({
    records,
    total: countResult.total,
    page,
    pageSize,
  });
}
