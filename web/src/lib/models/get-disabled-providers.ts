import { BYOK_PROVIDERS } from "@/db/schema";

const NON_BYOK_PROVIDERS = ["meta", "amazon"];

/**
 * Returns providers that should be disabled in the model selector.
 * - NON_BYOK providers (meta, amazon) are always disabled (no API key support)
 * - BYOK providers without a configured key are disabled
 */
export function getDisabledProviders(
  allProviders: string[],
  configuredProviders: string[]
): string[] {
  const configured = new Set(configuredProviders);
  const byokSet = new Set<string>(BYOK_PROVIDERS);

  return [...new Set(allProviders)].filter((p) => {
    if (NON_BYOK_PROVIDERS.includes(p)) return true;
    if (byokSet.has(p) && !configured.has(p)) return true;
    return false;
  });
}
