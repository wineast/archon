import type { MemoryRow } from "@/db/schema";

/**
 * Format memories into a text block suitable for injection into the system prompt.
 */
export function formatMemoriesForInjection(items: MemoryRow[]): string {
  if (items.length === 0) return "";

  const lines = items.map((m) => {
    const scope = m.userId ? "user" : "global";
    return `- [${m.type}] (${scope}, importance: ${m.importance}) ${m.content}`;
  });

  return [
    "<memories>",
    "The following are relevant memories about the user and prior interactions:",
    ...lines,
    "</memories>",
  ].join("\n");
}
