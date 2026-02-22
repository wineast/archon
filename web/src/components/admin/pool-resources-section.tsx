"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Trash2Icon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  usePoolResources,
  createPoolResource,
  deletePoolResource,
} from "@/lib/pool/hooks";
import { RESOURCE_TYPES } from "@/db/schema";
import type { ResourceType } from "@/db/schema";
import { toast } from "sonner";

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  tool: "Tools",
  component: "Components",
  function: "Functions",
  dataset: "Datasets",
  wiki: "Wiki",
  schema: "Schemas",
  "mcp-server": "MCP",
};

function PoolResourceList({ resourceType }: { resourceType: ResourceType }) {
  const t = useTranslations("admin");
  const { data: resources = [], isLoading, mutate } = usePoolResources<{
    id: string;
    key: string;
    name: string;
    origin: string;
  }>(resourceType);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");

  const handleCreate = useCallback(async () => {
    if (!newKey.trim() || !newName.trim()) return;
    setBusy(true);
    try {
      const data: Record<string, unknown> = {
        key: newKey.trim(),
        name: newName.trim(),
        description: "",
      };
      // Add required fields based on resource type
      if (resourceType === "function") {
        data.code = "";
      }
      if (resourceType === "tool") {
        data.description = "";
      }
      if (resourceType === "dataset") {
        data.data = {};
      }
      if (resourceType === "wiki") {
        data.content = "";
      }
      if (resourceType === "schema") {
        data.parameters = {};
      }
      if (resourceType === "mcp-server") {
        data.url = "";
      }
      await createPoolResource(resourceType, data, mutate);
      setCreateOpen(false);
      setNewKey("");
      setNewName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }, [resourceType, newKey, newName, mutate]);

  const handleDelete = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await deletePoolResource(resourceType, id, mutate);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to delete";
        if (msg.includes("still referenced")) {
          toast.error(t("deletePoolConflict", { count: "?" }));
        } else {
          toast.error(msg);
        }
      } finally {
        setBusy(false);
      }
    },
    [resourceType, mutate, t],
  );

  const originBadge = (origin: string) => {
    switch (origin) {
      case "builtin":
        return <Badge variant="default" className="text-[10px]">{t("poolOriginBuiltin")}</Badge>;
      case "marketplace":
        return <Badge variant="secondary" className="text-[10px]">{t("poolOriginMarketplace")}</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{t("poolOriginUser")}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t("poolResources", { count: resources.length })}
        </span>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="mr-1 size-3" />
          {t("createPoolResource")}
        </Button>
      </div>

      {resources.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("noPoolResources")}
        </p>
      ) : (
        <ScrollArea className="max-h-80 min-h-0">
          <div className="space-y-1">
            {resources.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.key}</p>
                </div>
                {originBadge(r.origin)}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={busy}
                  onClick={() => handleDelete(r.id)}
                >
                  <Trash2Icon className="size-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("createPoolResource")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Key</label>
              <Input
                className="mt-1"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="resource_key"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                className="mt-1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Resource Name"
              />
            </div>
            <Button className="w-full" disabled={busy || !newKey.trim() || !newName.trim()} onClick={handleCreate}>
              {busy ? <Spinner className="mr-2 size-4" /> : null}
              {t("createPoolResource")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PoolResourcesSection() {
  const t = useTranslations("admin");

  return (
    <div>
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">
        {t("resourcePool")}
      </h2>
      <Tabs defaultValue="tool">
        <TabsList className="h-8">
          {RESOURCE_TYPES.map((rt) => (
            <TabsTrigger key={rt} value={rt} className="text-xs">
              {RESOURCE_TYPE_LABELS[rt]}
            </TabsTrigger>
          ))}
        </TabsList>
        {RESOURCE_TYPES.map((rt) => (
          <TabsContent key={rt} value={rt} className="mt-3">
            <PoolResourceList resourceType={rt} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
