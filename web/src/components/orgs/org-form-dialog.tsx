"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { createOrg, updateOrg } from "@/lib/orgs/hooks";
import type { OrgWithRole } from "@/lib/orgs/hooks";
import type { KeyedMutator } from "swr";

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface OrgFormData {
  name: string;
  slug: string;
}

interface OrgFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org?: OrgWithRole | null;
  mutate: KeyedMutator<OrgWithRole[]>;
}

export function OrgFormDialog({
  open,
  onOpenChange,
  org,
  mutate,
}: OrgFormDialogProps) {
  const isEdit = !!org;

  const { register, handleSubmit: rhfHandleSubmit, reset, setValue, control } =
    useForm<OrgFormData>({
      defaultValues: { name: "", slug: "" },
    });
  const nameValue = useWatch({ control, name: "name" });
  const [slugManual, setSlugManual] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      if (org) {
        reset({ name: org.name, slug: org.slug });
        setSlugManual(true);
      } else {
        reset({ name: "", slug: "" });
        setSlugManual(false);
      }
    }
  }, [open, org, reset]);

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
    async (data: OrgFormData) => {
      if (!data.name.trim()) return;
      setBusy(true);
      try {
        if (isEdit && org) {
          await updateOrg(org.id, { name: data.name, slug: data.slug }, mutate);
        } else {
          await createOrg({ name: data.name, slug: data.slug }, mutate);
        }
        onOpenChange(false);
      } finally {
        setBusy(false);
      }
    },
    [isEdit, org, mutate, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑组织" : "创建组织"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "修改组织信息" : "创建一个新的组织"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={rhfHandleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">名称</Label>
            <Input
              id="org-name"
              {...register("name")}
              onChange={handleNameChange}
              placeholder="我的团队"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              {...register("slug")}
              onChange={handleSlugChange}
              placeholder="my-team"
            />
            <p className="text-xs text-muted-foreground">
              URL 路径标识，仅支持小写字母、数字和连字符
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              取消
            </Button>
            <Button type="submit" disabled={!nameValue.trim() || busy}>
              {busy && <Spinner className="mr-2" />}
              {isEdit ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
