"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { IconPicker } from "./icon-picker";
import { createAgent, updateAgent } from "@/lib/agents/hooks";
import type { AgentRow } from "@/db/schema";
import type { KeyedMutator } from "swr";

function nameToSlug(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ascii || "";
}

interface AgentFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: AgentRow | null;
  mutate: KeyedMutator<AgentRow[]>;
}

export function AgentFormSheet({
  open,
  onOpenChange,
  agent,
  mutate,
}: AgentFormSheetProps) {
  const isEdit = !!agent;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("bot");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      if (agent) {
        setName(agent.name);
        setSlug(agent.slug);
        setSlugManual(true);
        setDescription(agent.description);
        setIcon(agent.icon);
      } else {
        setName("");
        setSlug("");
        setSlugManual(false);
        setDescription("");
        setIcon("bot");
      }
    }
  }, [open, agent]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setName(v);
      if (!slugManual) {
        setSlug(nameToSlug(v));
      }
    },
    [slugManual]
  );

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSlugManual(true);
      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      setBusy(true);
      try {
        if (isEdit && agent) {
          await updateAgent(
            agent.id,
            { name, slug, description, icon },
            mutate
          );
        } else {
          await createAgent({ name, slug, description, icon }, mutate);
        }
        onOpenChange(false);
      } finally {
        setBusy(false);
      }
    },
    [name, slug, description, icon, isEdit, agent, mutate, onOpenChange]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "编辑 Agent" : "新建 Agent"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "修改 Agent 的配置信息" : "创建一个新的 Agent"}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">名称</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={handleNameChange}
              placeholder="我的 Agent"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-slug">Slug</Label>
            <Input
              id="agent-slug"
              value={slug}
              onChange={handleSlugChange}
              placeholder="my-agent"
            />
            <p className="text-xs text-muted-foreground">
              URL 路径标识，仅支持小写字母、数字和连字符
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-desc">描述</Label>
            <Textarea
              id="agent-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="这个 Agent 的用途..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>图标</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div className="mt-auto pt-4">
            <Button type="submit" className="w-full" disabled={!name.trim() || busy}>
              {busy && <Spinner className="mr-2" />}
              {isEdit ? "保存" : "创建"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
