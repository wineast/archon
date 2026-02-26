"use client";

import { useMemo, useState } from "react";
import { BookOpenIcon, ChevronRightIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";
import type { GuideNavGroup } from "./guide-nav-config";

interface GuideSidebarProps {
  groups: GuideNavGroup[];
}

function filterGroups(
  groups: GuideNavGroup[],
  query: string
): GuideNavGroup[] {
  if (!query) return groups;
  const q = query.toLowerCase();
  const result: GuideNavGroup[] = [];
  for (const group of groups) {
    const filtered = group.items.filter((item) =>
      item.title.toLowerCase().includes(q)
    );
    if (filtered.length > 0) {
      result.push({ ...group, items: filtered });
    }
  }
  return result;
}

export function GuideSidebar({ groups }: GuideSidebarProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => filterGroups(groups, search),
    [groups, search]
  );

  const isActive = (slug: string) => pathname === `/guide/${slug}`;
  const isGroupActive = (group: GuideNavGroup) =>
    group.items.some((item) => isActive(item.slug));

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 border-b p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BookOpenIcon className="size-4" />
          <span>操作手册</span>
        </div>
        <SidebarInput
          placeholder="搜索文档..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </SidebarHeader>
      <SidebarContent>
        {filtered.map((group) => (
          <Collapsible
            key={group.group}
            defaultOpen={isGroupActive(group) || !!search}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger>
                  {group.group}
                  <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.slug}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.slug)}
                          tooltip={item.title}
                        >
                          <Link href={`/guide/${item.slug}`}>
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
