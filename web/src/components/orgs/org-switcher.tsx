"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { BuildingIcon, CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrgs } from "@/lib/orgs/hooks";
import type { OrgWithRole } from "@/lib/orgs/hooks";
import { useOrgStore } from "@/stores/org-store";

interface OrgSwitcherProps {
  onCreateOrg?: () => void;
}

export function OrgSwitcher({ onCreateOrg }: OrgSwitcherProps) {
  const { orgs } = useOrgs();
  const { currentOrgId, setCurrentOrgId } = useOrgStore();
  const searchParams = useSearchParams();

  // Auto-select first org if none selected or stored org no longer exists
  // Skip if URL ?org param points to a valid org (useOrgParam will handle it)
  useEffect(() => {
    if (orgs.length === 0) return;
    if (currentOrgId && orgs.some((o) => o.id === currentOrgId)) return;

    const slugParam = searchParams.get("org");
    if (slugParam && orgs.some((o) => o.slug === slugParam)) return;

    setCurrentOrgId(orgs[0].id);
  }, [currentOrgId, orgs, setCurrentOrgId, searchParams]);

  const currentOrg = orgs.find((o) => o.id === currentOrgId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <BuildingIcon className="size-4" />
          <span className="max-w-[120px] truncate">
            {currentOrg?.name ?? "Select Org"}
          </span>
          <ChevronsUpDownIcon className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setCurrentOrgId(org.id)}
            className="gap-2"
          >
            <BuildingIcon className="size-4 shrink-0" />
            <span className="flex-1 truncate">{org.name}</span>
            {org.id === currentOrgId && (
              <CheckIcon className="size-4 shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        {onCreateOrg && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCreateOrg} className="gap-2">
              <PlusIcon className="size-4" />
              创建组织
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
