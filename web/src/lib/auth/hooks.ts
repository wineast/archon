"use client";

import useSWR from "swr";
import type { AgentRole } from "@/db/schema";
import { AGENT_ROLE_LEVELS } from "@/db/schema";
import type { User } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ── Agent Role ──

interface AgentRoleData {
  role: AgentRole;
  isSuperAdmin: boolean;
}

export function useAgentRole(agentId?: string) {
  const { data, error, isLoading } = useSWR<AgentRoleData>(
    agentId ? `/api/agents/${agentId}/role` : null,
    fetcher
  );

  const role = data?.role ?? null;
  const isSuperAdmin = data?.isSuperAdmin ?? false;
  const level = role ? AGENT_ROLE_LEVELS[role] : -1;

  return {
    role,
    isSuperAdmin,
    isLoading,
    error,
    canChat: level >= AGENT_ROLE_LEVELS.viewer,
    canEdit: level >= AGENT_ROLE_LEVELS.editor,
    canManageMembers: level >= AGENT_ROLE_LEVELS.admin,
    canDelete: level >= AGENT_ROLE_LEVELS.owner,
    canTransferOwner: level >= AGENT_ROLE_LEVELS.owner,
    canViewAllSessions: level >= AGENT_ROLE_LEVELS.admin,
  };
}

// ── Current User ──

export function useCurrentUser() {
  const { data, error, isLoading } = useSWR<User>("/api/user", fetcher);

  return {
    user: data ?? null,
    isLoading,
    error,
    isSuperAdmin: data?.platformRole === "super_admin",
  };
}
