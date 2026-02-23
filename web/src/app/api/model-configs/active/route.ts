import { NextResponse } from "next/server";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveVersionByMode } from "@/lib/versions/resolve";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const directVersionId = url.searchParams.get("versionId");
  let versionId: string | null;
  if (directVersionId) {
    const { validateVersionBelongsToAgent } = await import("@/lib/versions/resolve");
    const valid = await validateVersionBelongsToAgent(agentId, directVersionId);
    if (!valid) {
      return NextResponse.json({ error: "invalid_version", message: "Version not found for this agent" }, { status: 404 });
    }
    versionId = directVersionId;
  } else {
    const mode = url.searchParams.get("mode");
    versionId = await resolveVersionByMode(agentId, mode);
  }
  if (!versionId) {
    return NextResponse.json({ error: "not_published", message: "Agent has no published version" }, { status: 404 });
  }

  const [active] = await db
    .select()
    .from(modelConfigs)
    .where(and(eq(modelConfigs.versionId, versionId), eq(modelConfigs.isActive, true), isNull(modelConfigs.deletedAt)))
    .limit(1);

  if (!active) {
    return NextResponse.json(null);
  }

  return NextResponse.json(active);
}
