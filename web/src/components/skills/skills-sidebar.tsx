"use client";

import { useTranslations } from "next-intl";
import { PlusIcon, PowerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import skillsGuide from "../../../guide/skills.md";
import type { SkillRow } from "@/db/schema";
import { cn } from "@/lib/utils";

interface SkillsSidebarProps {
  skills: SkillRow[];
  activeSkillId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDisableFeature?: () => void;
}

export function SkillsSidebar({
  skills,
  activeSkillId,
  onSelect,
  onCreate,
  onDisableFeature,
}: SkillsSidebarProps) {
  const t = useTranslations("build");
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">{t("skills")}</span>
          <GuideDialog title="技能模块" content={skillsGuide} />
        </div>
        <div className="flex items-center gap-0.5">
          {onDisableFeature && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onDisableFeature}
              title={t("disableSkills")}
            >
              <PowerIcon className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onCreate}
            title={t("newSkill")}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {skills.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noSkills")}
            </p>
          ) : (
            skills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => onSelect(skill.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  activeSkillId === skill.id && "bg-accent font-medium"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    skill.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"
                  )}
                />
                <span className="flex-1 truncate">{skill.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {skill.order}
                </span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
