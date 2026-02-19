import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { AuditLogAction, AuditLogResourceType } from "@/db/schema";

interface LogAuditParams {
  agentId: string;
  userId: string;
  action: AuditLogAction;
  resourceType: AuditLogResourceType;
  resourceId: string;
  resourceKey?: string | null;
  resourceName?: string | null;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      agentId: params.agentId,
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceKey: params.resourceKey ?? null,
      resourceName: params.resourceName ?? null,
    });
  } catch (e) {
    console.error("[audit] failed to log audit:", e);
  }
}
