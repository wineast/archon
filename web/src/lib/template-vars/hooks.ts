"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { TemplateVarRow } from "@/db/schema";
import { parseTemplateVarValue } from "@/lib/template-vars/parse";

export const TEMPLATE_VARS_API_KEY = "/api/template-vars";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTemplateVarRows() {
  const { data, error, isLoading, mutate } = useSWR<TemplateVarRow[]>(
    TEMPLATE_VARS_API_KEY,
    fetcher
  );

  return {
    rows: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useTemplateVarsMap() {
  const { rows, isLoading, error, mutate } = useTemplateVarRows();

  const templateVars: Record<string, unknown> = {};
  for (const row of rows) {
    templateVars[row.key] = parseTemplateVarValue(row.value, row.type, row.isArray);
  }

  return { templateVars, isLoading, error, mutate };
}

export async function createTemplateVar(
  data: {
    agentId?: string;
    key: string;
    value: string;
    type?: string;
    isArray?: boolean;
  },
  mutate: () => void
) {
  try {
    const res = await fetch(TEMPLATE_VARS_API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("createTemplateVar failed:", e);
    toast.error("Failed to create template variable");
    return null;
  }
}

export async function updateTemplateVar(
  id: string,
  data: { key?: string; description?: string | null; value?: string; type?: string; isArray?: boolean },
  mutate: () => void
) {
  try {
    const res = await fetch(`${TEMPLATE_VARS_API_KEY}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  } catch (e) {
    console.error("updateTemplateVar failed:", e);
    toast.error("Failed to save template variable");
    return null;
  }
}

export async function deleteTemplateVar(id: string, mutate: () => void) {
  try {
    const res = await fetch(`${TEMPLATE_VARS_API_KEY}/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return true;
  } catch (e) {
    console.error("deleteTemplateVar failed:", e);
    toast.error("Failed to delete template variable");
    return false;
  }
}
