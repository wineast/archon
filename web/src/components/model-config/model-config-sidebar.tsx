"use client";

import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import modelConfigGuide from "../../../guide/model-config.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ModelConfigRow } from "@/db/schema";
import { ModelConfigListItem } from "./model-config-list-item";

interface ModelConfigSidebarProps {
  configs: ModelConfigRow[];
  activeConfigId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function ModelConfigSidebar({
  configs,
  activeConfigId,
  onSelect,
  onCreate,
}: ModelConfigSidebarProps) {
  const t = useTranslations("build");
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">{t("modelConfig")}</span>
          <GuideDialog title="模型配置" content={modelConfigGuide} />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title={t("newModelConfig")}
          data-testid="btn-new-model-config"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {configs.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noModelConfigs")}
            </p>
          ) : (
            configs.map((config) => (
              <ModelConfigListItem
                key={config.id}
                config={config}
                isSelected={activeConfigId === config.id}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
