"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { IconPicker } from "./icon-picker";
import { createAgent, updateAgent } from "@/lib/agents/hooks";
import type { AgentWithRole } from "@/lib/agents/hooks";
import type { AgentRow } from "@/db/schema";
import type { KeyedMutator } from "swr";

function nameToSlug(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ascii || "";
}

interface AgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: AgentRow | null;
  mutate: KeyedMutator<AgentWithRole[]>;
  orgId: string;
}

export function AgentFormDialog({
  open,
  onOpenChange,
  agent,
  mutate,
  orgId,
}: AgentFormDialogProps) {
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

  const handleReset = useCallback(() => {
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
  }, [agent]);

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
          await createAgent({ name, slug, description, icon, orgId }, mutate);
        }
        onOpenChange(false);
      } finally {
        setBusy(false);
      }
    },
    [name, slug, description, icon, isEdit, agent, mutate, onOpenChange, orgId]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑 Agent" : "新建 Agent"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "修改 Agent 的配置信息" : "创建一个新的 Agent"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <DialogFooter>
            {isEdit && (
              <Button type="button" variant="outline" onClick={handleReset} disabled={busy}>
                重置
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              取消
            </Button>
            <Button type="submit" disabled={!name.trim() || busy}>
              {busy && <Spinner className="mr-2" />}
              {isEdit ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
