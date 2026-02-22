import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { functions } from "@/db/schema";
import type { FunctionRow } from "@/db/schema";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { validateObjectSchema } from "@/lib/schemas/json-schema-utils";
import { logAudit } from "@/lib/audit/log";
import { getAgentResources } from "@/lib/pool/queries";

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await getAgentResources<FunctionRow>(agentId, "function");
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

  for (const [field, label] of [
    ["parametersSchema", "parametersSchema"],
    ["returnParametersSchema", "returnParametersSchema"],
  ] as const) {
    const err = validateObjectSchema(body[field], label);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const [row] = await db
    .insert(functions)
    .values({
      agentId,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
      code: body.code,
      parametersSchema: body.parametersSchema ?? null,
      returnParametersSchema: body.returnParametersSchema ?? null,
    })
    .returning();

  after(async () => {
    await logAudit({
      agentId,
      userId: ctx.user.id,
      action: "created",
      resourceType: "function",
      resourceId: row.id,
      resourceKey: row.key,
      resourceName: row.name,
    });
  });

  return NextResponse.json(row, { status: 201 });
}
