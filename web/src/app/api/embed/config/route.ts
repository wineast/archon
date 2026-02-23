import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireEmbedToken } from "@/lib/auth/require-embed-token";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { db } from "@/db";
import { agents, chatConfigs, tools, components, modelConfigs, agentResourceRefs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(req: Request) {
  let agentId: string;
  let versionId: string;
  let agentRow: { id: string; name: string; icon: string };

  // Dual auth: try embed token first, then Clerk session
  const authHeader = req.headers.get("authorization");
  const hasEmbedToken = authHeader?.startsWith("Bearer et_");

  if (hasEmbedToken) {
    // Embed token path — use published version
    const ctx = await requireEmbedToken(req);
    if (ctx instanceof NextResponse) return ctx;
    agentId = ctx.agent.id;
    if (!ctx.agent.publishedVersionId) {
      return NextResponse.json({ error: "Agent has no published version" }, { status: 404 });
    }
    versionId = ctx.agent.publishedVersionId;
    agentRow = { id: ctx.agent.id, name: ctx.agent.name, icon: ctx.agent.icon };
  } else {
    // Clerk session path (for internal assist mode) — use editing version
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

    // Load agent name/icon + editingVersionId
    const [agent] = await db
      .select({ id: agents.id, name: agents.name, icon: agents.icon, editingVersionId: agents.editingVersionId })
      .from(agents)
      .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
      .limit(1);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    if (!agent.editingVersionId) {
      return NextResponse.json({ error: "Agent has no editing version" }, { status: 404 });
    }
    versionId = agent.editingVersionId;
    agentRow = agent;
  }

  // Fetch chatConfig, tools, components (agent-owned + pool refs) in parallel
  // All queries scoped to versionId (published for embed, editing for assist)
  const [chatConfig, activeModelConfig, toolRows, ownComponentRows, poolComponentRows] = await Promise.all([
    db
      .select()
      .from(chatConfigs)
      .where(eq(chatConfigs.versionId, versionId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        modelId: modelConfigs.modelId,
        systemPrompt: modelConfigs.systemPrompt,
        temperature: modelConfigs.temperature,
      })
      .from(modelConfigs)
      .where(and(eq(modelConfigs.versionId, versionId), eq(modelConfigs.isActive, true)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        name: tools.name,
        component: components.key,
        componentSource: components.componentSource,
        executionTarget: tools.executionTarget,
        uiHidden: tools.uiHidden,
      })
      .from(tools)
      .leftJoin(components, eq(tools.componentId, components.id))
      .where(and(eq(tools.versionId, versionId), eq(tools.enabled, true), isNull(tools.deletedAt))),
    // Agent-owned components
    db
      .select({
        key: components.key,
        componentSource: components.componentSource,
        generatedCss: components.generatedCss,
      })
      .from(components)
      .where(and(eq(components.versionId, versionId), isNull(components.deletedAt))),
    // Pool components via agentResourceRefs
    db
      .select({
        key: components.key,
        componentSource: components.componentSource,
        generatedCss: components.generatedCss,
      })
      .from(agentResourceRefs)
      .innerJoin(components, eq(components.id, agentResourceRefs.resourceId))
      .where(and(
        eq(agentResourceRefs.versionId, versionId),
        eq(agentResourceRefs.resourceType, "component"),
        isNull(components.agentId),
        isNull(components.deletedAt),
      )),
  ]);

  // Merge and deduplicate components (agent-owned takes precedence)
  const seenKeys = new Set<string>();
  const componentRows: typeof ownComponentRows = [];
  for (const c of ownComponentRows) {
    seenKeys.add(c.key);
    componentRows.push(c);
  }
  for (const c of poolComponentRows) {
    if (!seenKeys.has(c.key)) {
      seenKeys.add(c.key);
      componentRows.push(c);
    }
  }

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
