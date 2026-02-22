"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
import { RotateCcwIcon, SaveIcon } from "lucide-react";
import deepEqual from "fast-deep-equal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { ModelCombobox } from "@/components/model-config/model-combobox";
import {
  useOrgBuildChatSettings,
  updateOrgBuildChatSettings,
} from "@/lib/orgs/build-chat-settings-hooks";
import { useOrgConfiguredProviders } from "@/lib/orgs/configured-providers-hooks";
import { useModels } from "@/lib/models/hooks";
import { getDisabledProviders } from "@/lib/models/get-disabled-providers";
import { toast } from "sonner";

interface FormValues {
  buildChatModel: string;
  buildChatTemperature: number;
  assistModel: string;
}

const DEFAULTS: FormValues = {
  buildChatModel: "anthropic/claude-sonnet-4",
  buildChatTemperature: 0.3,
  assistModel: "anthropic/claude-sonnet-4",
};

export function OrgBuildChatPanel({ orgId }: { orgId: string }) {
  const t = useTranslations("org");
  const tc = useTranslations("common");
  const { settings, isLoading, mutate } = useOrgBuildChatSettings(orgId);
  const [busy, setBusy] = useState(false);

  const { configuredProviders } = useOrgConfiguredProviders(orgId);
  const { models } = useModels();
  const disabledProviders = useMemo(
    () => getDisabledProviders(models.map((m) => m.provider), configuredProviders),
    [models, configuredProviders]
  );

  const originalRef = useRef<FormValues>(DEFAULTS);

  const form = useForm<FormValues>({
    defaultValues: DEFAULTS,
  });

  // Sync server data into form
  useEffect(() => {
    if (settings) {
      const values: FormValues = {
        buildChatModel: settings.buildChatModel ?? DEFAULTS.buildChatModel,
        buildChatTemperature:
          settings.buildChatTemperature ?? DEFAULTS.buildChatTemperature,
        assistModel: settings.assistModel ?? DEFAULTS.assistModel,
      };
      originalRef.current = values;
      form.reset(values);
    }
  }, [settings, form]);

  const watched = form.watch();
  const dirty = !deepEqual(watched, originalRef.current);

  const handleSave = form.handleSubmit(async (values) => {
    setBusy(true);
    const ok = await updateOrgBuildChatSettings(
      orgId,
      {
        buildChatModel: values.buildChatModel,
        buildChatTemperature: values.buildChatTemperature,
        assistModel: values.assistModel,
      },
      mutate
    );
    if (ok) {
      originalRef.current = values;
      toast.success(tc("saveSuccess"));
    }
    setBusy(false);
  });

  const handleReset = () => {
    form.reset(originalRef.current);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-lg space-y-4 p-6">
          <div>
            <Label className="text-xs font-medium text-muted-foreground">
              {t("buildChatModel")}
            </Label>
            <Controller
              control={form.control}
              name="buildChatModel"
              render={({ field }) => (
                <ModelCombobox
                  value={field.value}
                  onChange={field.onChange}
                  className="mt-1"
                  disabledProviders={disabledProviders}
                />
              )}
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">
              {t("buildChatTemperature")}
            </Label>
            <Input
              type="number"
              min={0}
              max={2}
              step={0.1}
              className="mt-1 h-8 w-32"
              {...form.register("buildChatTemperature", { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">
              {t("assistModel")}
            </Label>
            <Controller
              control={form.control}
              name="assistModel"
              render={({ field }) => (
                <ModelCombobox
                  value={field.value}
                  onChange={field.onChange}
                  className="mt-1"
                  disabledProviders={disabledProviders}
                />
              )}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Bottom action bar */}
      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button size="sm" disabled={!dirty || busy} onClick={handleSave}>
          {busy ? (
            <Spinner className="mr-1 size-3.5" />
          ) : (
            <SaveIcon className="mr-1 size-3.5" />
          )}
          {busy ? tc("saving") : tc("save")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!dirty || busy}
          onClick={handleReset}
        >
          <RotateCcwIcon className="mr-1 size-3.5" />
          {tc("reset")}
        </Button>
      </div>
    </div>
  );
}
