import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import type { AuditLogResourceType, AuditLogAction } from "@/db/schema";
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
  const resourceType = url.searchParams.get("resourceType") as AuditLogResourceType | null;
  const action = url.searchParams.get("action") as AuditLogAction | null;
  const userId = url.searchParams.get("userId");
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

  const conditions = [eq(auditLogs.agentId, agentId)];
  if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));
  if (action) conditions.push(eq(auditLogs.action, action));
  if (userId) conditions.push(eq(auditLogs.userId, userId));
  if (cursor) conditions.push(lt(auditLogs.createdAt, new Date(cursor)));

  const rows = await db
    .select({
      id: auditLogs.id,
      agentId: auditLogs.agentId,
      userId: auditLogs.userId,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      resourceKey: auditLogs.resourceKey,
      resourceName: auditLogs.resourceName,
      createdAt: auditLogs.createdAt,
      userNickname: users.nickname,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? items[items.length - 1].createdAt.toISOString()
    : undefined;

  return NextResponse.json({ items, nextCursor });
}
