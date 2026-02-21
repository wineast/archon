"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon, PowerIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useSkills,
  useSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  toggleSkillEnabled,
} from "@/lib/skills/hooks";
import { SkillsSidebar } from "./skills-sidebar";
import { SkillDetail } from "./skill-detail";
import { SkillsEmptyState } from "./skills-empty-state";
import { SkillCreateDialog } from "./skill-create-dialog";

interface SkillsPanelProps {
  agentId: string;
  skillsEnabled: boolean;
  onToggleFeature: (enabled: boolean) => Promise<void>;
}

export function SkillsPanel({ agentId, skillsEnabled, onToggleFeature }: SkillsPanelProps) {
  const { skills, mutate: mutateList } = useSkills(agentId);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const { skill: activeSkill, mutate: mutateDetail } =
    useSkill(activeSkillId);

  useEffect(() => {
    if (activeSkillId) {
      setMobileView("detail");
    }
  }, [activeSkillId]);

  const openCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreateWithKey = useCallback(
    async (key: string, name: string) => {
      const result = await createSkill(
        { key, name, description: "", content: "", agentId },
        mutateList
      );
      if (result?.id) {
        setActiveSkillId(result.id);
        setCreateDialogOpen(false);
      }
    },
    [mutateList, agentId]
  );

  const handleSave = useCallback(
    async (
      id: string,
      data: { name: string; description: string; content: string; enabled: boolean; order: number }
    ) => {
      await updateSkill(id, data, () => {
        mutateList();
        mutateDetail();
      });
    },
    [mutateList, mutateDetail]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteSkill(id, mutateList);
      if (activeSkillId === id) setActiveSkillId(null);
    },
    [mutateList, activeSkillId]
  );

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      await toggleSkillEnabled(id, enabled, () => {
        mutateList();
        mutateDetail();
      });
    },
    [mutateList, mutateDetail]
  );

  const handleEnable = useCallback(async () => {
    setToggling(true);
    await onToggleFeature(true);
    setToggling(false);
  }, [onToggleFeature]);

  const handleDisable = useCallback(async () => {
    await onToggleFeature(false);
  }, [onToggleFeature]);

  // Feature disabled state
  if (!skillsEnabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <ZapIcon className="size-12 opacity-30" />
        <p className="text-sm">Skills 功能未启用</p>
        <Button variant="outline" size="sm" onClick={handleEnable} disabled={toggling}>
          {toggling ? <Spinner className="mr-1.5 size-4" /> : <PowerIcon className="mr-1.5 size-4" />}
          启用
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <SkillsSidebar
          skills={skills}
          activeSkillId={activeSkillId}
          onSelect={setActiveSkillId}
          onCreate={openCreateDialog}
          onDisableFeature={() => setConfirmDisableOpen(true)}
        />
        <div className="flex-1 overflow-hidden">
          {activeSkill ? (
            <SkillDetail
              key={activeSkill.id}
              skill={activeSkill}
              agentId={agentId}
              onSave={handleSave}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          ) : (
            <SkillsEmptyState onCreate={openCreateDialog} />
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col sm:hidden">
        {mobileView === "sidebar" || !activeSkill ? (
          <SkillsSidebar
            skills={skills}
            activeSkillId={activeSkillId}
            onSelect={setActiveSkillId}
            onCreate={openCreateDialog}
            onDisableFeature={() => setConfirmDisableOpen(true)}
          />
        ) : (
          <>
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setMobileView("sidebar")}
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
              <span className="text-sm font-medium">Back</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <SkillDetail
                key={activeSkill.id}
                skill={activeSkill}
                agentId={agentId}
                onSave={handleSave}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            </div>
          </>
        )}
      </div>

      <SkillCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateWithKey}
      />

      <ConfirmDialog
        open={confirmDisableOpen}
        onOpenChange={setConfirmDisableOpen}
        title="关闭 Skills 功能"
        description="关闭后，聊天运行时将不再注入技能摘要和 get_skill_detail 工具。已有技能数据不会删除，重新启用即可恢复。"
        cancelLabel="取消"
        confirmLabel="确认关闭"
        confirmVariant="default"
        onConfirm={handleDisable}
      />
    </div>
  );
}
