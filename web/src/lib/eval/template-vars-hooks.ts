"use client";

import { useDatasetVarsMap } from "@/lib/datasets/hooks";

export function useTemplateVars() {
  const { datasetVars } = useDatasetVarsMap();
  return { templateVars: datasetVars };
}
