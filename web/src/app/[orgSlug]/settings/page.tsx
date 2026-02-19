"use client";

import { use, useCallback, useState } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeftIcon,
  BarChart3Icon,
  BuildingIcon,
  UsersIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OrgMembersPanel } from "@/components/orgs/org-members-panel";
import { OrgUsagePanel } from "@/components/orgs/org-usage-panel";
import { useOrgRole } from "@/lib/auth/hooks";
import { updateOrg, useOrgs } from "@/lib/orgs/hooks";
import { cn } from "@/lib/utils";
import type { OrgRow } from "@/db/schema";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SettingsTab {
  value: string;
  label: string;
  icon: LucideIcon;
  minRole: "manage" | "delete";
}

const TABS: SettingsTab[] = [
  { value: "info", label: "基本信息", icon: BuildingIcon, minRole: "manage" },
  { value: "members", label: "成员", icon: UsersIcon, minRole: "manage" },
  { value: "usage", label: "用量", icon: BarChart3Icon, minRole: "manage" },
];

function OrgInfoPanel({ org }: { org: OrgRow }) {
  const { mutate } = useOrgs();
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [busy, setBusy] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    setBusy(true);
    const result = await updateOrg(org.id, { name, slug }, mutate);
    if (result) {
      toast.success("保存成功");
    }
    setBusy(false);
  }, [org.id, name, slug, mutate]);

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-lg space-y-6 p-6">
        <div className="space-y-2">
          <Label htmlFor="org-name">名称</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-slug">Slug</Label>
          <Input
            id="org-slug"
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
          />
          <p className="text-xs text-muted-foreground">
            URL 路径标识，仅支持小写字母、数字和连字符
          </p>
        </div>
        <Button disabled={busy || !name.trim()} onClick={handleSave}>
          {busy && <Spinner className="mr-2" />}
          保存
        </Button>
      </div>
    </ScrollArea>
  );
}

function OrgSettingsContent({ org }: { org: OrgRow }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "info";

  const { canManage, isLoading: roleLoading } = useOrgRole(org.id);

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "info") {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }
      const qs = params.toString();
      router.replace(`/${org.slug}/settings${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [searchParams, router, org.slug]
  );

  if (roleLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!canManage) {
    notFound();
  }

  function renderPanel() {
    switch (activeTab) {
      case "info":
        return <OrgInfoPanel org={org} />;
      case "members":
        return <OrgMembersPanel orgId={org.id} />;
      case "usage":
        return <OrgUsagePanel orgId={org.id} />;
      default:
        return <OrgInfoPanel org={org} />;
    }
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <Button variant="ghost" size="icon" className="size-8" asChild>
          <Link href="/">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <span className="text-sm font-medium">
          {org.name}
          <span className="text-muted-foreground"> · 组织设置</span>
        </span>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {/* Desktop nav */}
        <nav className="hidden w-48 shrink-0 flex-col gap-1 border-r p-2 sm:flex">
          {TABS.map((t) => {
            const isActive = t.value === activeTab;
            return (
              <button
                key={t.value}
                onClick={() => handleTabChange(t.value)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  isActive && "bg-accent text-foreground font-medium"
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Mobile tabs */}
        <div className="flex shrink-0 overflow-x-auto border-b sm:hidden">
          {TABS.map((t) => {
            const isActive = t.value === activeTab;
            return (
              <button
                key={t.value}
                onClick={() => handleTabChange(t.value)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground whitespace-nowrap transition-colors",
                  isActive && "border-foreground text-foreground font-medium"
                )}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {renderPanel()}
        </div>
      </div>
    </div>
  );
}

export default function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);

  const { data: orgs, isLoading } = useSWR<OrgRow[]>("/api/orgs", fetcher);

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  const org = orgs?.find((o) => o.slug === orgSlug);
  if (!org) {
    notFound();
  }

  return <OrgSettingsContent org={org} />;
}
