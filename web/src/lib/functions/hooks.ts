"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { FunctionRow } from "@/db/schema";
import type { ToolParameter } from "@/lib/tools/types";

export const FUNCTIONS_API_KEY = "/api/functions";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useFunctions() {
  const { data, error, isLoading, mutate } = useSWR<FunctionRow[]>(
    FUNCTIONS_API_KEY,
    fetcher
  );

  return {
    functions: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useFunction(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<FunctionRow>(
    id ? `${FUNCTIONS_API_KEY}/${id}` : null,
    fetcher
  );

  return {
    fn: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function createFunction(
  data: {
    key: string;
    name: string;
    description?: string;
    code: string;
    parameters?: ToolParameter[];
    agentId?: string;
  },
  mutate: () => void
) {
  try {
    const res = await fetch(FUNCTIONS_API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createFunction failed:", e);
    toast.error("Failed to create function");
    return null;
  }
}

export async function updateFunction(
  id: string,
  data: Record<string, unknown>,
  mutate: () => void
) {
  try {
    const res = await fetch(`${FUNCTIONS_API_KEY}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateFunction failed:", e);
    toast.error("Failed to save function");
    return null;
  }
}

export async function deleteFunction(id: string, mutate: () => void) {
  try {
    const res = await fetch(`${FUNCTIONS_API_KEY}/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteFunction failed:", e);
    toast.error("Failed to delete function");
    return false;
  }
}
