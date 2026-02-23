import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireEmbedToken } from "@/lib/auth/require-embed-token";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { db } from "@/db";
import { agents, chatConfigs, tools, components, modelConfigs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(req: Request) {
  let agentId: string;
  let agentRow: { id: string; name: string; icon: string };

  // Dual auth: try embed token first, then Clerk session
  const authHeader = req.headers.get("authorization");
  const hasEmbedToken = authHeader?.startsWith("Bearer et_");

  if (hasEmbedToken) {
    // Embed token path
    const ctx = await requireEmbedToken(req);
    if (ctx instanceof NextResponse) return ctx;
    agentId = ctx.agent.id;
    agentRow = { id: ctx.agent.id, name: ctx.agent.name, icon: ctx.agent.icon };
  } else {
    // Clerk session path (for internal assist mode)
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(req.url);
    const queryAgentId = url.searchParams.get("agentId");
    if (!queryAgentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }
    // Verify user has viewer access to this agent
    const roleResult = await requireAgentRole(queryAgentId, "viewer");
    if (roleResult instanceof NextResponse) return roleResult;
    agentId = queryAgentId;

    // Load agent name/icon
    const [agent] = await db
      .select({ id: agents.id, name: agents.name, icon: agents.icon })
      .from(agents)
      .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
      .limit(1);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    agentRow = agent;
  }

  // Fetch chatConfig, tools, and components in parallel
  const [chatConfig, activeModelConfig, toolRows, componentRows] = await Promise.all([
    db
      .select()
      .from(chatConfigs)
      .where(eq(chatConfigs.agentId, agentId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        modelId: modelConfigs.modelId,
        systemPrompt: modelConfigs.systemPrompt,
        temperature: modelConfigs.temperature,
      })
      .from(modelConfigs)
      .where(and(eq(modelConfigs.agentId, agentId), eq(modelConfigs.isActive, true)))
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
    agent: agentRow,
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
    modelConfig: activeModelConfig
      ? {
          modelId: activeModelConfig.modelId,
          systemPrompt: activeModelConfig.systemPrompt,
          temperature: activeModelConfig.temperature,
        }
      : null,
    tools: toolRows,
    components: componentRows,
  });
}
