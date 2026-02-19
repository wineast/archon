import { NextResponse } from "next/server";
import { db } from "@/db";
import { components } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { compileCssForComponent } from "@/lib/components/compile-css";

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
    .where(eq(components.agentId, agentId))
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
      componentSource,
      generatedCss,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
