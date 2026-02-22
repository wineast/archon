"use client";

import useSWR from "swr";
import type { KeyedMutator } from "swr";
import type { ResourceType } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function poolApiKey(resourceType: ResourceType) {
  return `/api/pool/${resourceType}`;
}

export function usePoolResources<T = Record<string, unknown>>(resourceType: ResourceType) {
  return useSWR<T[]>(poolApiKey(resourceType), fetcher);
}

export async function createPoolResource<T = Record<string, unknown>>(
  resourceType: ResourceType,
  data: Record<string, unknown>,
  mutate: KeyedMutator<T[]>,
) {
  const res = await fetch(`/api/pool/${resourceType}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  const created = await res.json();
  await mutate();
  return created as T;
}

export async function updatePoolResource<T = Record<string, unknown>>(
  resourceType: ResourceType,
  id: string,
  data: Record<string, unknown>,
  mutate: KeyedMutator<T[]>,
) {
  const res = await fetch(`/api/pool/${resourceType}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  const updated = await res.json();
  await mutate();
  return updated as T;
}

export async function deletePoolResource<T = Record<string, unknown>>(
  resourceType: ResourceType,
  id: string,
  mutate: KeyedMutator<T[]>,
) {
  const res = await fetch(`/api/pool/${resourceType}/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error || "Failed to delete");
  }
  await mutate();
}
