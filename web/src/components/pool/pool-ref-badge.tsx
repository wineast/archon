import { Badge } from "@/components/ui/badge";
import type { ResourceOrigin } from "@/db/schema";

interface PoolRefBadgeProps {
  origin: ResourceOrigin;
}

export function PoolRefBadge({ origin }: PoolRefBadgeProps) {
  return (
    <Badge variant="secondary">
      {origin === "builtin" ? "系统内置" : "共享池"}
    </Badge>
  );
}
