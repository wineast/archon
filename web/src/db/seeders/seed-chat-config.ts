import { join } from "path";
import { chatConfigs } from "../schema";
import { readJson, logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

export const seedChatConfig: Seeder = {
  name: "chat-config",
  async run(ctx) {
    logSection("Seeding chat config");

    const chatConfigSeed = readJson<{
      title: string;
      welcomeTitle: string;
      welcomeIcon: string;
      quickActions: string[];
      placeholder: string;
      suggestions: string[];
    }>(join(ctx.agentDir, "chat-config.json"));

    const [chatConfig] = await ctx.db
      .insert(chatConfigs)
      .values({ ...chatConfigSeed, agentId: ctx.agentId })
      .onConflictDoUpdate({
        target: chatConfigs.agentId,
        set: {
          title: chatConfigSeed.title,
          welcomeTitle: chatConfigSeed.welcomeTitle,
          welcomeIcon: chatConfigSeed.welcomeIcon,
          quickActions: chatConfigSeed.quickActions,
          placeholder: chatConfigSeed.placeholder,
          suggestions: chatConfigSeed.suggestions,
        },
      })
      .returning();

    ctx.ids.chatConfigId = chatConfig.id;
    log("ok", `chat config (${chatConfig.id})`);
  },
};
