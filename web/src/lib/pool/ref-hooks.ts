"use client";

import useSWR from "swr";
import type { KeyedMutator } from "swr";
import type { AgentResourceRefRow, ResourceType } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function refsApiKey(agentId: string) {
  return `/api/agents/${agentId}/refs`;
}

export function useAgentRefs(agentId: string) {
  return useSWR<AgentResourceRefRow[]>(
    agentId ? refsApiKey(agentId) : null,
    fetcher,
  );
}

export async function addAgentRef(
  agentId: string,
  data: { resourceType: ResourceType; resourceId: string },
  mutate: KeyedMutator<AgentResourceRefRow[]>,
) {
  const res = await fetch(refsApiKey(agentId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  const created = await res.json();
  await mutate();
  return created as AgentResourceRefRow;
}

export async function removeAgentRef(
  agentId: string,
  refId: string,
  mutate: KeyedMutator<AgentResourceRefRow[]>,
) {
  const res = await fetch(`${refsApiKey(agentId)}/${refId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  await mutate();
}

export async function toggleAgentRef(
  agentId: string,
  refId: string,
  enabled: boolean,
  mutate: KeyedMutator<AgentResourceRefRow[]>,
) {
  const res = await fetch(`${refsApiKey(agentId)}/${refId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error(await res.text());
  await mutate();
}
