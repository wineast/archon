import { generateText } from "ai";
import { getContextWindow } from "tokenlens";
import { db } from "@/db";
import { chatSessions, models } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveModel } from "@/lib/ai/resolve-model";

/* ─────────── Constants ─────────── */

const COMPRESSION_MODEL = "openai/gpt-4o-mini";

/** Keep the most recent N UIMessages uncompressed (~5 rounds). */
export const KEEP_RECENT_COUNT = 10;

/** Trigger compression when inputTokens exceeds this ratio of model's inputMax. */
const THRESHOLD_RATIO = 0.75;

/** Fallback input max when neither DB nor tokenlens has data for the model. */
const FALLBACK_INPUT_MAX = 128_000;

/* ─────────── Types ─────────── */

export interface CompressionMetadata {
  summary: string;
  compressedCount: number;
  lastCompressedAt: string;
  lastInputTokens?: number;
}

/* ─────────── Compression Prompt ─────────── */

const COMPRESSION_SYSTEM_PROMPT = `你是一个对话摘要助手。请将以下对话内容压缩成简洁的摘要。

要求：
1. 保留所有关键信息：用户的核心需求、已做出的决策、重要的上下文背景
2. 保留工具调用的关键结果（成功/失败、返回的关键数据）
3. 丢弃寒暄、重复内容、已解决且不再影响后续对话的细节
4. 使用第三方视角描述（"用户询问了…"、"助手执行了…"）
5. 如果提供了之前的摘要，将其与新内容合并为一个完整的摘要
6. 控制在 800 字以内`;

/* ─────────── Public API ─────────── */

/**
 * Resolve the effective input max (context window) for a model.
 * Priority: models table `contextWindow` → tokenlens → 128K fallback.
 */
export async function getInputMax(modelId: string): Promise<number> {
  const [row] = await db
    .select({ contextWindow: models.contextWindow })
    .from(models)
    .where(eq(models.modelId, modelId))
    .limit(1);
  if (row?.contextWindow) return row.contextWindow;
  const ctx = getContextWindow(modelId);
  if (ctx?.inputMax) return ctx.inputMax;
  return FALLBACK_INPUT_MAX;
}

/**
 * Check whether the current input token count exceeds the compression threshold.
 * Pure function — caller resolves inputMax via `getInputMax()`.
 */
export function shouldCompress(
  inputTokens: number,
  inputMax: number
): boolean {
  return inputTokens > inputMax * THRESHOLD_RATIO;
}

/**
 * Call a small LLM to compress conversation text into a summary.
 */
export async function compressMessages(
  text: string,
  orgId: string | null
): Promise<string> {
  const { text: summary } = await generateText({
    model: await resolveModel(COMPRESSION_MODEL, orgId),
    system: COMPRESSION_SYSTEM_PROMPT,
    prompt: text,
  });
  return summary;
}

/**
 * Load compression metadata from a session's metadata field.
 */
export async function getCompressionData(
  sessionId: string
): Promise<CompressionMetadata | null> {
  const [row] = await db
    .select({ metadata: chatSessions.metadata })
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);

  const compression = (row?.metadata as Record<string, unknown> | null)
    ?.compression as CompressionMetadata | undefined;

  return compression ?? null;
}

/**
 * Persist compression metadata into the session's metadata field.
 */
export async function saveCompressionData(
  sessionId: string,
  data: CompressionMetadata
): Promise<void> {
  const [row] = await db
    .select({ metadata: chatSessions.metadata })
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);

  const existing = (row?.metadata as Record<string, unknown> | null) ?? {};
  await db
    .update(chatSessions)
    .set({
      metadata: { ...existing, compression: data },
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, sessionId));
}
