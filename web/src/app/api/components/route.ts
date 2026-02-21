import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { components } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { compileCssForComponent } from "@/lib/components/compile-css";
import { logAudit } from "@/lib/audit/log";

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select()
    .from(components)
    .where(and(eq(components.agentId, agentId), isNull(components.deletedAt)))
    .orderBy(components.key);
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

  const componentSource = body.componentSource ?? "";
  const generatedCss = await compileCssForComponent(componentSource);

  const [row] = await db
    .insert(components)
    .values({
      agentId,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
      inputSchema: body.inputSchema ?? null,
      componentSource,
      generatedCss,
    })
    .returning();

  after(async () => {
    await logAudit({
      agentId,
      userId: ctx.user.id,
      action: "created",
      resourceType: "component",
      resourceId: row.id,
      resourceKey: row.key,
      resourceName: row.name,
    });
  });

  return NextResponse.json(row, { status: 201 });
}
