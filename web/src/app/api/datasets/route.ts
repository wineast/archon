import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import type { DatasetRow } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { validateNoCycle } from "@/lib/datasets/queries";
import { logAudit } from "@/lib/audit/log";
import { getAgentResources } from "@/lib/pool/queries";
import { resolveEditingVersionId } from "@/lib/versions/resolve";

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const versionId = await resolveEditingVersionId(agentId);
  const rows = await getAgentResources<DatasetRow>(agentId, "dataset", versionId);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const agentId = body.agentId;
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const versionId = await resolveEditingVersionId(agentId);

  const newRow = {
    agentId: body.agentId ?? null,
    versionId,
    key: body.key,
    name: body.name,
    description: body.description ?? "",
    data: body.data,
  };

  // Validate no circular dependency
  if (newRow.agentId) {
    const existing = await db
      .select({ key: datasets.key, data: datasets.data })
      .from(datasets)
      .where(and(eq(datasets.agentId, newRow.agentId), isNull(datasets.deletedAt)));
    try {
      validateNoCycle([...existing, { key: newRow.key, data: newRow.data }]);
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message },
        { status: 400 }
      );
    }
  }

  const [row] = await db
    .insert(datasets)
    .values(newRow)
    .returning();

  after(async () => {
    await logAudit({
      agentId,
      userId: ctx.user.id,
      action: "created",
      resourceType: "dataset",
      resourceId: row.id,
      resourceKey: row.key,
      resourceName: row.name,
    });
  });

  return NextResponse.json(row, { status: 201 });
}
