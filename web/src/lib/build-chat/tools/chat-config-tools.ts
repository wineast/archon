import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { chatConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveEditingVersionId } from "@/lib/versions/resolve";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

export function buildChatConfigTools(agentId: string): Record<string, AnyTool> {
  return {
    get_chat_config: tool({
      description: "获取当前 Agent 的聊天配置",
      inputSchema: z.object({}),
      execute: async () => {
        const [row] = await db
          .select()
          .from(chatConfigs)
          .where(eq(chatConfigs.agentId, agentId))
          .limit(1);
        return {
          chatConfig: row ?? null,
          _mutateKeys: [`/api/chat-configs?agentId=${agentId}`],
        };
      },
    }),

    update_chat_config: tool({
      description: "更新聊天配置（不存在则自动创建）",
      inputSchema: z.object({
        title: z.string().optional(),
        welcomeTitle: z.string().optional(),
        welcomeSubtitle: z.string().optional(),
        welcomeIcon: z.string().optional(),
        placeholder: z.string().optional(),
        suggestions: z.array(z.string()).optional(),
        quickActions: z.array(z.string()).optional(),
        quickButtons: z
          .array(
            z.object({
              label: z.string(),
              icon: z.enum([
                "",
                "sparkles",
                "bot",
                "brain",
                "message-square",
                "wand",
                "zap",
                "lightbulb",
                "rocket",
              ]),
              message: z.string(),
            }),
          )
          .optional(),
      }),
      execute: async (params) => {
        // Upsert: try update first, then insert
        const [existing] = await db
          .select({ id: chatConfigs.id })
          .from(chatConfigs)
          .where(eq(chatConfigs.agentId, agentId))
          .limit(1);

        let row;
        if (existing) {
          [row] = await db
            .update(chatConfigs)
            .set(params)
            .where(eq(chatConfigs.id, existing.id))
            .returning();
        } else {
          const versionId = await resolveEditingVersionId(agentId);
          [row] = await db
            .insert(chatConfigs)
            .values({ ...params, agentId, versionId })
            .returning();
        }

        return {
          chatConfig: row,
          _mutateKeys: [`/api/chat-configs?agentId=${agentId}`],
        };
      },
    }),
  };
}
