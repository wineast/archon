"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { McpServerRow } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function mcpServersApiKey(agentId?: string) {
  return agentId ? `/api/mcp-servers?agentId=${agentId}` : null;
}

export function useMcpServers(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<WithPoolMeta<McpServerRow>[]>(
    mcpServersApiKey(agentId),
    fetcher
  );

  return {
    mcpServers: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useMcpServer(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<McpServerRow>(
    id ? `/api/mcp-servers/${id}` : null,
    fetcher
  );

  return {
    mcpServer: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function createMcpServer(
  data: {
    key: string;
    name: string;
    agentId: string;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/mcp-servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to create MCP server");
    }
    mutate();
    return res.json();
  } catch (e) {
    console.error("createMcpServer failed:", e);
    toast.error((e as Error).message || "Failed to create MCP server");
    return null;
  }
}

export async function updateMcpServer(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/mcp-servers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to save MCP server");
    }
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateMcpServer failed:", e);
    toast.error((e as Error).message || "Failed to save MCP server");
    return null;
  }
}

export async function deleteMcpServer(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/mcp-servers/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    toast.success("已移至回收站");
    return true;
  } catch (e) {
    console.error("deleteMcpServer failed:", e);
    toast.error("Failed to delete MCP server");
    return false;
  }
}

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface TestMcpServerResult {
  ok: boolean;
  tools?: McpToolDef[];
  toolCount?: number;
  error?: string;
}

export async function testMcpServer(
  id: string,
  overrides?: { url: string; transportType: string; headers: Record<string, string> }
): Promise<TestMcpServerResult> {
  try {
    const res = await fetch(`/api/mcp-servers/${id}/test`, {
      method: "POST",
      headers: overrides ? { "Content-Type": "application/json" } : undefined,
      body: overrides ? JSON.stringify(overrides) : undefined,
    });
    return res.json();
  } catch (e) {
    console.error("testMcpServer failed:", e);
    return { ok: false, error: (e as Error).message };
  }
}

export async function executeMcpTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
  overrides?: { url: string; transportType: string; headers: Record<string, string> }
) {
  try {
    const res = await fetch(`/api/mcp-servers/${serverId}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolName, args, ...overrides }),
    });
    return res.json();
  } catch (e) {
    console.error("executeMcpTool failed:", e);
    return { ok: false, error: (e as Error).message };
  }
}
