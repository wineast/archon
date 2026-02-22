"use client";

import useSWR from "swr";
import type { AgentRole, OrgRole } from "@/db/schema";
import { AGENT_ROLE_LEVELS, ORG_ROLE_LEVELS } from "@/db/schema";
import type { User } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ── Org Role ──

interface OrgRoleData {
  role: OrgRole;
  isSuperAdmin: boolean;
}

export function useOrgRole(orgId?: string) {
  const { data, error, isLoading } = useSWR<OrgRoleData>(
    orgId ? `/api/orgs/${orgId}/role` : null,
    fetcher
  );

  const role = data?.role ?? null;
  const isSuperAdmin = data?.isSuperAdmin ?? false;
  const level = role ? ORG_ROLE_LEVELS[role] : -1;

  return {
    role,
    isSuperAdmin,
    isLoading,
    error,
    canView: level >= ORG_ROLE_LEVELS.member,
    canManage: level >= ORG_ROLE_LEVELS.admin,
    canDelete: level >= ORG_ROLE_LEVELS.owner,
  };
}

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
  const { data, error, isLoading, mutate } = useSWR<User>("/api/user", fetcher);

  const isPendingDeletion = !!data?.deletedAt;

  return {
    user: data ?? null,
    isLoading,
    error,
    mutate,
    isSuperAdmin: data?.platformRole === "super_admin",
    isPendingDeletion,
    deletedAt: data?.deletedAt ?? null,
  };
}
