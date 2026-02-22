import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { validateObjectSchema } from "@/lib/schemas/json-schema-utils";
import { logAudit } from "@/lib/audit/log";
import { getAgentTools } from "@/lib/pool/queries";
import { resolveEditingVersionId } from "@/lib/versions/resolve";

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const versionId = await resolveEditingVersionId(agentId);
  const rows = await getAgentTools(agentId, versionId);
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

  for (const [field, label] of [
    ["parametersSchema", "parametersSchema"],
    ["returnParametersSchema", "returnParametersSchema"],
  ] as const) {
    const err = validateObjectSchema(body[field], label);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const [row] = await db
    .insert(tools)
    .values({
      agentId,
      versionId,
      key: body.key,
      name: body.name,
      description: body.description,
      parametersSchema: body.parametersSchema ?? null,
      returnParametersSchema: body.returnParametersSchema ?? null,
      handler: body.handler ?? null,
      url: body.url ?? null,
      componentId: body.componentId ?? null,
      enabled: body.enabled ?? true,
      executionTarget: body.executionTarget ?? "server",
    })
    .returning();

  after(async () => {
    await logAudit({
      agentId,
      userId: ctx.user.id,
      action: "created",
      resourceType: "tool",
      resourceId: row.id,
      resourceKey: row.key,
      resourceName: row.name,
    });
  });

  return NextResponse.json(row, { status: 201 });
}
