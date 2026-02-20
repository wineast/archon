"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { ObjectTypeRow, ObjectRelationRow, ObjectInstanceRow, ObjectLinkRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ─────────── Object Types ─────────── */

export function objectTypesApiKey(agentId?: string) {
  return agentId ? `/api/object-types?agentId=${agentId}` : null;
}

export function useObjectTypes(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ObjectTypeRow[]>(
    objectTypesApiKey(agentId),
    fetcher
  );

  return {
    objectTypes: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createObjectType(
  data: {
    agentId: string;
    key: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    schemaId?: string | null;
    order?: number;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/object-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createObjectType failed:", e);
    toast.error("Failed to create object type");
    return null;
  }
}

export async function updateObjectType(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/object-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateObjectType failed:", e);
    toast.error("Failed to save object type");
    return null;
  }
}

export async function deleteObjectType(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/object-types/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Delete failed");
    }
    mutate();
    toast.success("已移至回收站");
    return true;
  } catch (e) {
    console.error("deleteObjectType failed:", e);
    toast.error(e instanceof Error ? e.message : "Failed to delete object type");
    return false;
  }
}

/* ─────────── Object Relations ─────────── */

export function objectRelationsApiKey(agentId?: string) {
  return agentId ? `/api/object-relations?agentId=${agentId}` : null;
}

export function useObjectRelations(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ObjectRelationRow[]>(
    objectRelationsApiKey(agentId),
    fetcher
  );

  return {
    objectRelations: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createObjectRelation(
  data: {
    agentId: string;
    key: string;
    name: string;
    description?: string;
    sourceTypeId: string;
    targetTypeId: string;
    relationType: string;
    inverseName?: string;
    order?: number;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/object-relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createObjectRelation failed:", e);
    toast.error("Failed to create relation");
    return null;
  }
}

export async function updateObjectRelation(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/object-relations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateObjectRelation failed:", e);
    toast.error("Failed to save relation");
    return null;
  }
}

export async function deleteObjectRelation(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/object-relations/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Delete failed");
    }
    mutate();
    toast.success("已移至回收站");
    return true;
  } catch (e) {
    console.error("deleteObjectRelation failed:", e);
    toast.error(e instanceof Error ? e.message : "Failed to delete relation");
    return false;
  }
}

/* ─────────── Object Instances ─────────── */

export function objectInstancesApiKey(agentId?: string, objectTypeId?: string) {
  if (!agentId) return null;
  let url = `/api/object-instances?agentId=${agentId}`;
  if (objectTypeId) url += `&objectTypeId=${objectTypeId}`;
  return url;
}

export function useObjectInstances(agentId?: string, objectTypeId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ObjectInstanceRow[]>(
    objectInstancesApiKey(agentId, objectTypeId),
    fetcher
  );

  return {
    instances: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createObjectInstance(
  data: {
    agentId: string;
    objectTypeId: string;
    data?: Record<string, unknown>;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/object-instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createObjectInstance failed:", e);
    toast.error("Failed to create instance");
    return null;
  }
}

export async function updateObjectInstance(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/object-instances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateObjectInstance failed:", e);
    toast.error("Failed to save instance");
    return null;
  }
}

export async function deleteObjectInstance(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/object-instances/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Delete failed");
    }
    mutate();
    return true;
  } catch (e) {
    console.error("deleteObjectInstance failed:", e);
    toast.error(e instanceof Error ? e.message : "Failed to delete instance");
    return false;
  }
}

/* ─────────── Batch Create Instances ─────────── */

export async function batchCreateObjectInstances(
  data: {
    agentId: string;
    objectTypeId: string;
    items: Array<{ data: Record<string, unknown> }>;
  },
  mutate: () => void
): Promise<{ created: number; errors: Array<{ index: number; message: string }> } | null> {
  try {
    const res = await fetch("/api/object-instances/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();
    mutate();
    if (result.created > 0) {
      toast.success(`Imported ${result.created} instance(s)`);
    }
    if (result.errors?.length > 0) {
      toast.error(`${result.errors.length} row(s) failed to import`);
    }
    return result;
  } catch (e) {
    console.error("batchCreateObjectInstances failed:", e);
    toast.error("Failed to batch import instances");
    return null;
  }
}

/* ─────────── Object Links ─────────── */

export function objectLinksApiKey(agentId?: string, instanceId?: string) {
  if (!agentId) return null;
  let url = `/api/object-links?agentId=${agentId}`;
  if (instanceId) url += `&instanceId=${instanceId}`;
  return url;
}

export function useObjectLinks(agentId?: string, instanceId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ObjectLinkRow[]>(
    objectLinksApiKey(agentId, instanceId),
    fetcher
  );

  return {
    links: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createObjectLink(
  data: {
    agentId: string;
    relationId: string;
    sourceId: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  },
  mutate: () => void
) {
  try {
    const res = await fetch("/api/object-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createObjectLink failed:", e);
    toast.error("Failed to create link");
    return null;
  }
}

export async function deleteObjectLink(id: string, mutate: () => void) {
  try {
    const res = await fetch(`/api/object-links/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Delete failed");
    }
    mutate();
    return true;
  } catch (e) {
    console.error("deleteObjectLink failed:", e);
    toast.error(e instanceof Error ? e.message : "Failed to delete link");
    return false;
  }
}

/* ─────────── Generate CRUD Tools ─────────── */

export async function generateCrudTools(
  objectTypeId: string,
  mutate: () => void
) {
  try {
    const res = await fetch(`/api/object-types/${objectTypeId}/generate-tools`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Generation failed");
    }
    const result = await res.json();
    if (result.created?.length > 0) {
      toast.success(`Created tools: ${result.created.join(", ")}`);
    }
    if (result.skipped?.length > 0) {
      toast.info(`Skipped (already exist): ${result.skipped.join(", ")}`);
    }
    mutate();
    return result;
  } catch (e) {
    console.error("generateCrudTools failed:", e);
    toast.error(e instanceof Error ? e.message : "Failed to generate CRUD tools");
    return null;
  }
}
