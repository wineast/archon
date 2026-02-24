"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
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

interface AgentFormData {
  name: string;
  slug: string;
  description: string;
  icon: string;
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
  const t = useTranslations("agent");
  const tc = useTranslations("common");
  const isEdit = !!agent;

  const { register, handleSubmit: rhfHandleSubmit, reset, setValue, control } =
    useForm<AgentFormData>({
      defaultValues: { name: "", slug: "", description: "", icon: "bot" },
    });
  const nameValue = useWatch({ control, name: "name" });
  const [slugManual, setSlugManual] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      if (agent) {
        reset({
          name: agent.name,
          slug: agent.slug,
          description: agent.description,
          icon: agent.icon,
        });
        setSlugManual(true);
      } else {
        reset({ name: "", slug: "", description: "", icon: "bot" });
        setSlugManual(false);
      }
    }
  }, [open, agent, reset]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue("name", v);
      if (!slugManual) {
        setValue("slug", nameToSlug(v));
      }
    },
    [slugManual, setValue]
  );

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSlugManual(true);
      setValue("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    },
    [setValue]
  );

  const onSubmit = useCallback(
    async (data: AgentFormData) => {
      if (!data.name.trim()) return;
      setBusy(true);
      try {
        if (isEdit && agent) {
          await updateAgent(
            agent.id,
            { name: data.name, slug: data.slug, description: data.description, icon: data.icon },
            mutate,
            t
          );
        } else {
          await createAgent(
            { name: data.name, slug: data.slug, description: data.description, icon: data.icon, orgId },
            mutate,
            t
          );
        }
        onOpenChange(false);
      } finally {
        setBusy(false);
      }
    },
    [isEdit, agent, mutate, onOpenChange, orgId, t]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editAgent") : t("newAgent")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editDescription") : t("newDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={rhfHandleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">{t("name")}</Label>
            <Input
              id="agent-name"
              {...register("name")}
              onChange={handleNameChange}
              placeholder={t("namePlaceholder")}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-slug">{t("slug")}</Label>
            <Input
              id="agent-slug"
              {...register("slug")}
              onChange={handleSlugChange}
              placeholder={t("slugPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("slugHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-desc">{t("description")}</Label>
            <Textarea
              id="agent-desc"
              {...register("description")}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("icon")}</Label>
            <Controller
              name="icon"
              control={control}
              render={({ field }) => (
                <IconPicker value={field.value} onChange={field.onChange} />
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={!nameValue.trim() || busy} data-testid="btn-submit-agent">
              {busy && <Spinner className="mr-2" />}
              {isEdit ? tc("save") : tc("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
