"use client";

import { useDatasetVarsMap } from "@/lib/datasets/hooks";

export function useTemplateVars(agentId?: string) {
  const { datasetVars } = useDatasetVarsMap(agentId);
  return { templateVars: datasetVars };
}
