import useSWR from "swr";
import type { ModelRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useModels() {
  const { data, error, isLoading } = useSWR<ModelRow[]>("/api/models", fetcher);
  return { models: data ?? [], isLoading, error };
}
