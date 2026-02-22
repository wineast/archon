import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { memories, agents, memoryConfigs } from "@/db/schema";
import type { MemoryTypeDef } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { resolveModel } from "@/lib/ai/resolve-model";
import { QuotaExceededError } from "@/lib/credits/errors";
import { generateEmbedding } from "./embedding";

/* ─────────── Default Extraction Prompt ─────────── */

const DEFAULT_EXTRACTION_PROMPT = `你是一个记忆提取助手。你的任务是从用户与 AI 的对话中提取值得长期记住的信息。

请识别以下类型的信息：
- 用户明确表达的偏好和习惯
- 关于用户或其业务的重要事实
- 用户做出的关键决策
- 用户提出的需求或反馈
- 值得记录的重要事件

提取规则：
1. 只提取明确表述的信息，不要推测或编造
2. 每条记忆应该是独立的、自包含的陈述
3. 内容要简洁明了，去掉多余的上下文
4. 忽略闲聊、问候等无实质内容的对话
5. 如果对话中没有值得记忆的信息，返回空数组`;

/* ─────────── Extraction Model ─────────── */

const EXTRACTION_MODEL = "openai/gpt-4o-mini";

/* ─────────── Types ─────────── */

interface ExtractedMemory {
  type: string;
  content: string;
  importance: number;
}

interface ExtractMemoriesOptions {
  agentId: string;
  sessionId: string | null;
  userId: string | null;
  /** Serialised conversation for the LLM (role: content pairs). */
  conversationText: string;
}

/* ─────────── Main entry ─────────── */

/**
 * Attempt to extract memories from a completed conversation.
 * Designed to run inside Next.js after() — never throws, logs errors.
 */
export async function extractMemories(
  opts: ExtractMemoriesOptions
): Promise<void> {
  try {
    await _extractMemoriesInner(opts);
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      console.warn("[memory-extract] skipped — quota exceeded");
      return;
    }
    console.error("[memory-extract] failed:", e);
  }
}

/* ─────────── Guard + Logic ─────────── */

async function _extractMemoriesInner(
  opts: ExtractMemoriesOptions
): Promise<void> {
  const { agentId, sessionId, userId, conversationText } = opts;

  // Guard 1: agent.memoryEnabled
  const [agent] = await db
    .select({ memoryEnabled: agents.memoryEnabled, orgId: agents.orgId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);
  if (!agent?.memoryEnabled) return;

  // Guard 2: memoryConfig.autoExtract
  const [config] = await db
    .select()
    .from(memoryConfigs)
    .where(eq(memoryConfigs.agentId, agentId))
    .limit(1);
  if (!config?.autoExtract) return;

  // Guard 3: must have at least one memory type defined
  const typeDefs: MemoryTypeDef[] = config.memoryTypeDefs ?? [];
  if (typeDefs.length === 0) return;

  // Build prompt
  const systemPrompt = buildSystemPrompt(
    config.extractionPrompt || DEFAULT_EXTRACTION_PROMPT,
    typeDefs
  );

  // Call LLM
  const extracted = await callExtractionLLM(systemPrompt, conversationText, typeDefs, agent.orgId);
  if (extracted.length === 0) return;

  // Deduplicate against existing memories
  const fresh = await dedup(agentId, userId, extracted);
  if (fresh.length === 0) return;

  // Generate embeddings (best-effort, failures → null)
  const embeddings = await Promise.all(
    fresh.map((m) =>
      generateEmbedding(m.content, agent.orgId).catch(() => null)
    )
  );

  // Insert
  await db.insert(memories).values(
    fresh.map((m, i) => ({
      agentId,
      userId,
      sessionId,
      type: m.type,
      content: m.content,
      importance: m.importance,
      metadata: { source: "auto_extract" } as Record<string, unknown>,
      embedding: embeddings[i],
    }))
  );

  console.log(
    `[memory-extract] agent=${agentId} extracted ${fresh.length} memories`
  );
}

/* ─────────── Helpers ─────────── */

function buildSystemPrompt(
  extractionPrompt: string,
  typeDefs: MemoryTypeDef[]
): string {
  const typeList = typeDefs
    .map((t) => `- ${t.key}: ${t.description}`)
    .join("\n");

  return `${extractionPrompt}

可用的记忆类型：
${typeList}

请严格使用以上列出的 type key，不要使用其他类型。`;
}

async function callExtractionLLM(
  systemPrompt: string,
  conversationText: string,
  typeDefs: MemoryTypeDef[],
  orgId?: string | null
): Promise<ExtractedMemory[]> {
  const validTypes = typeDefs.map((t) => t.key);

  const schema = z.object({
    memories: z.array(
      z.object({
        type: z.string().describe("记忆类型 key"),
        content: z.string().describe("记忆内容，简洁明了的陈述"),
        importance: z
          .number()
          .min(0)
          .max(1)
          .describe("重要度 0-1，1 最重要"),
      })
    ),
  });

  const { object } = await generateObject({
    model: await resolveModel(EXTRACTION_MODEL, orgId),
    schema,
    system: systemPrompt,
    prompt: conversationText,
  });

  // Filter out invalid types
  return object.memories.filter((m) => validTypes.includes(m.type));
}

async function dedup(
  agentId: string,
  userId: string | null,
  extracted: ExtractedMemory[]
): Promise<ExtractedMemory[]> {
  // Load existing memories for this agent+user
  const conditions = [
    eq(memories.agentId, agentId),
    isNull(memories.deletedAt),
  ];
  if (userId) {
    conditions.push(eq(memories.userId, userId));
  }

  const existing = await db
    .select({ content: memories.content })
    .from(memories)
    .where(and(...conditions));

  const existingContents = new Set(
    existing.map((r) => r.content.toLowerCase().trim())
  );

  return extracted.filter((m) => {
    const normalized = m.content.toLowerCase().trim();
    // Exact match dedup
    if (existingContents.has(normalized)) return false;
    // Substring containment dedup (either direction)
    for (const ec of existingContents) {
      if (normalized.includes(ec) || ec.includes(normalized)) return false;
    }
    return true;
  });
}

/* ─────────── Conversation Serialiser ─────────── */

/**
 * Convert UI messages to a text block for the extraction LLM.
 * Only includes user and assistant text content.
 */
export function serialiseConversation(
  messages: Array<{ role: string; parts?: unknown[] }>
): string {
  const lines: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    const textParts = extractText(msg.parts ?? []);
    if (textParts) {
      const label = msg.role === "user" ? "用户" : "助手";
      lines.push(`${label}: ${textParts}`);
    }
  }
  return lines.join("\n\n");
}

function extractText(parts: unknown[]): string {
  return (parts as Array<Record<string, unknown>>)
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n")
    .trim();
}
