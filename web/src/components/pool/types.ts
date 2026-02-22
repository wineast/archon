import type { ResourceOrigin } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";

/**
 * Metadata for pool-referenced resources in detail views.
 * When present, the detail view should render in read-only mode.
 */
export interface PoolMeta {
  source: "pool";
  refId: string;
  refEnabled: boolean;
  origin: ResourceOrigin;
}

/**
 * Extract PoolMeta from a WithPoolMeta resource.
 * Returns undefined if the resource is private.
 */
export function toPoolMeta<T extends { origin?: ResourceOrigin }>(
  item: WithPoolMeta<T>,
): PoolMeta | undefined {
  if (item._source !== "pool" || !item._refId) return undefined;
  return {
    source: "pool",
    refId: item._refId,
    refEnabled: item._refEnabled ?? true,
    origin: item.origin ?? "user",
  };
}
