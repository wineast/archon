import { getSessionByShareId } from "@/db/chat-persistence";
import { db } from "@/db";
import { tools, components } from "@/db/schema";
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

  // Build toolComponentSourceMap for dynamic tool UIs
  const toolComponentSourceMap: Record<string, string> = {};
  const dynamicComponentCss: string[] = [];
  if (session.agentId) {
    const [toolRows, componentRows] = await Promise.all([
      db
        .select({
          name: tools.name,
          component: tools.component,
          componentSource: tools.componentSource,
        })
        .from(tools)
        .where(eq(tools.agentId, session.agentId)),
      db
        .select({
          key: components.key,
          componentSource: components.componentSource,
          generatedCss: components.generatedCss,
        })
        .from(components)
        .where(eq(components.agentId, session.agentId)),
    ]);

    const componentMap = new Map(componentRows.map((c) => [c.key, c.componentSource]));
    for (const r of toolRows) {
      const source = (r.component && componentMap.get(r.component)) || r.componentSource;
      if (source) toolComponentSourceMap[r.name] = source;
    }

    // Collect generated CSS from components
    for (const c of componentRows) {
      if (c.generatedCss) dynamicComponentCss.push(c.generatedCss);
    }
  }

  return NextResponse.json({
    id: session.id,
    title: session.title,
    sharedAt: session.sharedAt,
    agentSlug: session.agentSlug,
    messages: session.messages,
    toolComponentSourceMap,
    dynamicComponentCss,
  });
}
