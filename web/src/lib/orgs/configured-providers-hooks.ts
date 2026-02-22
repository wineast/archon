import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch");
    return r.json();
  });

export function useOrgConfiguredProviders(orgId?: string | null) {
  const { data, error, isLoading } = useSWR<string[]>(
    orgId ? `/api/orgs/${orgId}/configured-providers` : null,
    fetcher
  );

  return {
    configuredProviders: data ?? [],
    isLoading,
    error,
  };
}
