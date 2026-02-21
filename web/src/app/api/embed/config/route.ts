import { NextResponse } from "next/server";
import { requireEmbedToken } from "@/lib/auth/require-embed-token";
import { db } from "@/db";
import { chatConfigs, tools, components } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(req: Request) {
  const ctx = await requireEmbedToken(req);
  if (ctx instanceof NextResponse) return ctx;

  const agentId = ctx.agent.id;

  // Fetch chatConfig, tools, and components in parallel
  const [chatConfig, toolRows, componentRows] = await Promise.all([
    db
      .select()
      .from(chatConfigs)
      .where(eq(chatConfigs.agentId, agentId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        name: tools.name,
        component: components.key,
        componentSource: components.componentSource,
        executionTarget: tools.executionTarget,
      })
      .from(tools)
      .leftJoin(components, eq(tools.componentId, components.id))
      .where(and(eq(tools.agentId, agentId), eq(tools.enabled, true), isNull(tools.deletedAt))),
    db
      .select({
        key: components.key,
        componentSource: components.componentSource,
        generatedCss: components.generatedCss,
      })
      .from(components)
      .where(and(eq(components.agentId, agentId), isNull(components.deletedAt))),
  ]);

  return NextResponse.json({
    agent: {
      id: ctx.agent.id,
      name: ctx.agent.name,
      icon: ctx.agent.icon,
    },
    chatConfig: chatConfig
      ? {
          title: chatConfig.title,
          welcomeTitle: chatConfig.welcomeTitle,
          welcomeIcon: chatConfig.welcomeIcon,
          quickActions: chatConfig.quickActions,
          placeholder: chatConfig.placeholder,
          suggestions: chatConfig.suggestions,
          enableVoice: chatConfig.enableVoice,
          enableAttachment: chatConfig.enableAttachment,
        }
      : null,
    tools: toolRows,
    components: componentRows,
  });
}
