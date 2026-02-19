import { getSessionByShareId } from "@/db/chat-persistence";
import { db } from "@/db";
import { tools, components } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
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

  // Build toolComponentSourceMap for dynamic tool UIs
  const toolComponentSourceMap: Record<string, string> = {};
  const dynamicComponentCss: string[] = [];
  let componentRecords: Array<{ key: string; source: string }> = [];
  if (session.agentId) {
    const [toolRows, componentRows] = await Promise.all([
      db
        .select({
          name: tools.name,
          componentKey: components.key,
          componentSource: components.componentSource,
        })
        .from(tools)
        .leftJoin(components, eq(tools.componentId, components.id))
        .where(and(eq(tools.agentId, session.agentId), isNull(tools.deletedAt))),
      db
        .select({
          key: components.key,
          componentSource: components.componentSource,
          generatedCss: components.generatedCss,
        })
        .from(components)
        .where(and(eq(components.agentId, session.agentId), isNull(components.deletedAt))),
    ]);

    for (const r of toolRows) {
      if (r.componentSource) toolComponentSourceMap[r.name] = r.componentSource;
    }

    // Collect generated CSS from components
    for (const c of componentRows) {
      if (c.generatedCss) dynamicComponentCss.push(c.generatedCss);
    }

    // Build componentRecords for composition support
    componentRecords = componentRows
      .filter((c) => c.componentSource.trim())
      .map((c) => ({ key: c.key, source: c.componentSource }));
  }

  return NextResponse.json({
    id: session.id,
    title: session.title,
    sharedAt: session.sharedAt,
    agentSlug: session.agentSlug,
    messages: session.messages,
    toolComponentSourceMap,
    dynamicComponentCss,
    componentRecords,
  });
}
