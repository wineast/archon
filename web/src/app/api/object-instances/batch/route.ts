import { NextResponse } from "next/server";
import { db } from "@/db";
import { objectInstances, objectTypes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { extractLabel } from "@/lib/ontology/utils";

export async function POST(req: Request) {
  const body = await req.json();
  const { agentId, objectTypeId, items } = body as {
    agentId: string;
    objectTypeId: string;
    items: Array<{ data: Record<string, unknown> }>;
  };

  if (!agentId || !objectTypeId || !Array.isArray(items)) {
    return NextResponse.json(
      { error: "agentId, objectTypeId, and items[] are required" },
      { status: 400 }
    );
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [objType] = await db
    .select()
    .from(objectTypes)
    .where(
      and(eq(objectTypes.id, objectTypeId), eq(objectTypes.agentId, agentId))
    );

  if (!objType) {
    return NextResponse.json(
      { error: "Object type not found" },
      { status: 404 }
    );
  }

  let created = 0;
  const errors: Array<{ index: number; message: string }> = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const instanceData = items[i]!.data ?? {};
      const label = extractLabel(instanceData, objType.titleProperty);
      await db.insert(objectInstances).values({
        agentId,
        objectTypeId,
        label,
        data: instanceData,
        createdBy: ctx.user.clerkId,
      });
      created++;
    } catch (e) {
      errors.push({
        index: i,
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ created, errors });
}
