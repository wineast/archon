"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon, PowerIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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

  // First-time ceremony: only show when disabled AND no data
  if (!skillsEnabled && skills.length === 0) {
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
          skillsEnabled={skillsEnabled}
          onSelect={setActiveSkillId}
          onCreate={openCreateDialog}
          onToggleFeature={onToggleFeature}
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
            skillsEnabled={skillsEnabled}
            onSelect={setActiveSkillId}
            onCreate={openCreateDialog}
            onToggleFeature={onToggleFeature}
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
    </div>
  );
}
