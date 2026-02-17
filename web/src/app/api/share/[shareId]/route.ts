import { getSessionByShareId } from "@/db/chat-persistence";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params;
  const session = await getSessionByShareId(shareId);
  if (!session) {
    return NextResponse.json(
      { error: "Shared conversation not found" },
      { status: 404 }
    );
  }

  // Build toolComponentMap for the agent so share page can render custom tool UIs
  const toolComponentMap: Record<string, string> = {};
  if (session.agentId) {
    const rows = await db
      .select({ name: tools.name, component: tools.component })
      .from(tools)
      .where(eq(tools.agentId, session.agentId));
    for (const r of rows) {
      if (r.component) toolComponentMap[r.name] = r.component;
    }
  }

  return NextResponse.json({
    id: session.id,
    title: session.title,
    sharedAt: session.sharedAt,
    agentSlug: session.agentSlug,
    messages: session.messages,
    toolComponentMap,
  });
}
