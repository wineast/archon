import { db } from ".";
import { agents, chatSessions, messages } from "./schema";
import { eq, desc, sql, and, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import type {
  AssistantModelMessage,
  ToolModelMessage,
} from "@ai-sdk/provider-utils";

type ResponseMessage = AssistantModelMessage | ToolModelMessage;

/**
 * Convert response.messages (model format) to UI-compatible parts for persistence.
 *
 * Model format has separate messages:
 *   - role: 'assistant' with tool-call parts
 *   - role: 'tool' with tool-result parts
 *
 * UI format merges them into a single parts array:
 *   - { type: 'tool-<toolName>', toolCallId, state, input, output, callProviderMetadata? }
 */
export function responseMessagesToUIParts(
  responseMessages: ResponseMessage[]
): unknown[] {
  // 1. Collect tool results by toolCallId
  const toolResults = new Map<
    string,
    { output: unknown; providerOptions?: Record<string, unknown> }
  >();
  for (const msg of responseMessages) {
    if (msg.role !== "tool") continue;
    for (const part of msg.content) {
      if (part.type !== "tool-result") continue;
      // Extract the actual value from ToolResultOutput wrapper
      const rawOutput = part.output as
        | { type: string; value: unknown }
        | unknown;
      const output =
        typeof rawOutput === "object" &&
        rawOutput !== null &&
        "type" in rawOutput &&
        "value" in rawOutput
          ? (rawOutput as { value: unknown }).value
          : rawOutput;
      toolResults.set(part.toolCallId, {
        output,
        providerOptions: part.providerOptions as
          | Record<string, unknown>
          | undefined,
      });
    }
  }

  // 2. Convert assistant messages' content to UI parts
  const uiParts: unknown[] = [];
  for (const msg of responseMessages) {
    if (msg.role !== "assistant") continue;
    const content = msg.content;
    if (typeof content === "string") {
      if (content) {
        uiParts.push({ type: "text", text: content });
      }
      continue;
    }
    for (const part of content) {
      if (part.type === "text") {
        uiParts.push({ type: "text", text: part.text });
      } else if (part.type === "tool-call") {
        const result = toolResults.get(part.toolCallId);
        const uiPart: Record<string, unknown> = {
          type: `tool-${part.toolName}`,
          toolCallId: part.toolCallId,
          input: part.input,
        };
        if (result) {
          uiPart.state = "output-available";
          uiPart.output = result.output;
          if (part.providerOptions) {
            uiPart.callProviderMetadata = part.providerOptions;
          }
        } else {
          uiPart.state = "input-available";
        }
        uiParts.push(uiPart);
      } else if (part.type === "reasoning") {
        uiParts.push({
          type: "reasoning",
          text: part.text,
          providerMetadata: part.providerOptions,
        });
      }
      // Skip other part types (file, source, etc.) for now
    }
  }

  return uiParts;
}

export function extractTextContent(parts: unknown[]): string {
  return parts
    .filter(
      (p): p is { type: string; text: string } =>
        typeof p === "object" &&
        p !== null &&
        "type" in p &&
        (p as { type: string }).type === "text" &&
        "text" in p
    )
    .map((p) => p.text)
    .join("\n");
}

export async function createSession(opts: {
  id: string;
  title: string;
  model: string;
  systemPrompt?: string;
  agentId?: string;
  userId?: string;
}) {
  const [session] = await db
    .insert(chatSessions)
    .values({
      id: opts.id,
      title: opts.title,
      model: opts.model,
      systemPrompt: opts.systemPrompt,
      agentId: opts.agentId ?? null,
      userId: opts.userId ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return session;
}

export async function saveMessage(opts: {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  parts: unknown[];
}) {
  const content = extractTextContent(opts.parts);

  await db
    .insert(messages)
    .values({
      id: opts.id,
      sessionId: opts.sessionId,
      role: opts.role,
      parts: opts.parts,
      content: content || null,
    })
    .onConflictDoNothing();

  await db
    .update(chatSessions)
    .set({
      messageCount: sql`${chatSessions.messageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, opts.sessionId));
}

export async function updateSessionTitle(id: string, title: string) {
  const [session] = await db
    .update(chatSessions)
    .set({ title, updatedAt: new Date() })
    .where(eq(chatSessions.id, id))
    .returning();
  return session;
}

export async function listSessions(limit = 50, agentId?: string) {
  const query = db
    .select()
    .from(chatSessions)
    .orderBy(desc(chatSessions.updatedAt))
    .limit(limit);

  if (agentId) {
    return query.where(eq(chatSessions.agentId, agentId));
  }
  return query;
}

export async function listSessionsByUser(limit = 50, agentId: string, userId: string) {
  return db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.agentId, agentId), eq(chatSessions.userId, userId)))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(limit);
}

export async function getSession(id: string) {
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, id));
  return session ?? null;
}

export async function getSessionMessages(sessionId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt);
}

export async function updateSessionMetadata(
  id: string,
  patch: Record<string, unknown>
) {
  const session = await getSession(id);
  const merged = { ...(session?.metadata ?? {}), ...patch };
  await db
    .update(chatSessions)
    .set({ metadata: merged, updatedAt: new Date() })
    .where(eq(chatSessions.id, id));
}

export async function deleteSession(id: string) {
  await db.delete(chatSessions).where(eq(chatSessions.id, id));
}

export async function enableSessionShare(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) return null;
  if (session.shareId) return { shareId: session.shareId, sharedAt: session.sharedAt };

  const shareId = nanoid(10);
  const sharedAt = new Date();
  await db
    .update(chatSessions)
    .set({ shareId, sharedAt })
    .where(eq(chatSessions.id, sessionId));
  return { shareId, sharedAt };
}

export async function disableSessionShare(sessionId: string) {
  await db
    .update(chatSessions)
    .set({ shareId: null, sharedAt: null })
    .where(eq(chatSessions.id, sessionId));
}

export async function importSession(opts: {
  agentId: string;
  userId?: string;
  title: string;
  model: string;
  createdAt?: string;
  messages: {
    role: "user" | "assistant" | "system";
    parts: unknown[];
    content?: string | null;
    createdAt?: string;
  }[];
}) {
  const sessionId = crypto.randomUUID();

  await db.insert(chatSessions).values({
    id: sessionId,
    agentId: opts.agentId,
    userId: opts.userId ?? null,
    title: opts.title,
    model: opts.model,
    messageCount: opts.messages.length,
    createdAt: opts.createdAt ? new Date(opts.createdAt) : new Date(),
    updatedAt: new Date(),
  });

  for (const msg of opts.messages) {
    await db.insert(messages).values({
      id: crypto.randomUUID(),
      sessionId,
      role: msg.role,
      parts: msg.parts,
      content: msg.content ?? (extractTextContent(msg.parts) || null),
      createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
    });
  }

  return { sessionId };
}

export async function getSessionByShareId(shareId: string) {
  const rows = await db
    .select({
      session: chatSessions,
      agentSlug: agents.slug,
    })
    .from(chatSessions)
    .leftJoin(agents, eq(chatSessions.agentId, agents.id))
    .where(
      and(eq(chatSessions.shareId, shareId), isNotNull(chatSessions.sharedAt))
    );
  if (rows.length === 0) return null;

  const { session, agentSlug } = rows[0];

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, session.id))
    .orderBy(messages.createdAt);

  return { ...session, agentSlug, messages: msgs };
}
