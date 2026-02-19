import { NextResponse } from "next/server";
import { db } from "@/db";
import { runtimeEvents } from "@/db/schema";
import type { RuntimeEventType, RuntimeEventSeverity } from "@/db/schema";
import { eq, and, lt, desc } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const eventType = url.searchParams.get("eventType") as RuntimeEventType | null;
  const severity = url.searchParams.get("severity") as RuntimeEventSeverity | null;
  const sessionId = url.searchParams.get("sessionId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

  const conditions = [eq(runtimeEvents.agentId, agentId)];
  if (eventType) conditions.push(eq(runtimeEvents.eventType, eventType));
  if (severity) conditions.push(eq(runtimeEvents.severity, severity));
  if (sessionId) conditions.push(eq(runtimeEvents.sessionId, sessionId));
  if (from) {
    const { gte } = await import("drizzle-orm");
    conditions.push(gte(runtimeEvents.createdAt, new Date(from)));
  }
  if (to) {
    const { lte } = await import("drizzle-orm");
    conditions.push(lte(runtimeEvents.createdAt, new Date(to)));
  }
  if (cursor) conditions.push(lt(runtimeEvents.createdAt, new Date(cursor)));

  const rows = await db
    .select()
    .from(runtimeEvents)
    .where(and(...conditions))
    .orderBy(desc(runtimeEvents.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? items[items.length - 1].createdAt.toISOString()
    : undefined;

  return NextResponse.json({ items, nextCursor });
}
