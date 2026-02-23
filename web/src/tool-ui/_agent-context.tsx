"use client";
import { createContext, useContext, type ReactNode } from "react";

const AgentIdContext = createContext<string | null>(null);

export function AgentIdProvider({
  agentId,
  children,
}: {
  agentId: string;
  children: ReactNode;
}) {
  return <AgentIdContext value={agentId}>{children}</AgentIdContext>;
}

export function useAgentId(): string | null {
  return useContext(AgentIdContext);
}
