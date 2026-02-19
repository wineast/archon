import { db } from "@/db";
import { runtimeEvents } from "@/db/schema";
import type { RuntimeEventType, RuntimeEventSeverity } from "@/db/schema";

export interface RuntimeEventInput {
  agentId: string;
  sessionId?: string | null;
  eventType: RuntimeEventType;
  severity: RuntimeEventSeverity;
  metadata?: Record<string, unknown>;
  durationMs?: number | null;
}

export async function recordRuntimeEvents(
  events: RuntimeEventInput[]
): Promise<void> {
  if (events.length === 0) return;
  try {
    await db.insert(runtimeEvents).values(
      events.map((e) => ({
        agentId: e.agentId,
        sessionId: e.sessionId ?? null,
        eventType: e.eventType,
        severity: e.severity,
        metadata: e.metadata ?? null,
        durationMs: e.durationMs ?? null,
      }))
    );
  } catch (e) {
    console.error("[runtime-events] failed to record events:", e);
  }
}
