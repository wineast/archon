import { NextResponse } from "next/server";
import { db } from "@/db";
import { chatConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
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

  const [row] = await db
    .select()
    .from(chatConfigs)
    .where(eq(chatConfigs.versionId, versionId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "No chat config" }, { status: 404 });
  }

  return NextResponse.json(row);
}
