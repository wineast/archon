import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveVersionByRef } from "@/lib/versions/resolve";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  if (!ref) {
    return NextResponse.json(
      { error: "ref query parameter is required" },
      { status: 400 }
    );
  }

  const version = await resolveVersionByRef(agentId, ref);
  if (!version) {
    return NextResponse.json(
      { error: "version_not_found", message: `Version "${ref}" not found` },
      { status: 404 }
    );
  }

  return NextResponse.json(version);
}
