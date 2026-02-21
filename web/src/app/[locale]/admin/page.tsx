"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowLeftIcon, ShieldIcon, ShieldOffIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ModelCombobox } from "@/components/model-config/model-combobox";
import { InvitationCodesSection } from "@/components/admin/invitation-codes-section";
import {
  useAdminUsers,
  updateUserRole,
  useAdminSettings,
  updateAdminSettings,
} from "@/lib/admin/hooks";

function BuildChatSettings() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const { settings, isLoading, mutate } = useAdminSettings();
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setModel(settings.buildChatModel);
      setTemperature(settings.buildChatTemperature);
    }
  }, [settings]);

  const dirty =
    settings != null &&
    (model !== settings.buildChatModel ||
      temperature !== settings.buildChatTemperature);

  const handleSave = async () => {
    setSaving(true);
    await updateAdminSettings({ buildChatModel: model, buildChatTemperature: temperature }, mutate);
    setSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">
        {t("buildChatSettings")}
      </h2>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("model")}</Label>
          <ModelCombobox value={model} onChange={setModel} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("temperature")}</Label>
          <Input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
            className="h-8 w-32"
          />
        </div>
      </div>
      <Button
        size="sm"
        disabled={!dirty || saving}
        onClick={handleSave}
      >
        {saving ? <Spinner className="size-3.5" /> : tc("save")}
      </Button>
    </div>
  );
}

export default function AdminPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const { users, isLoading, mutate } = useAdminUsers();
  const [busy, setBusy] = useState(false);

  const handleToggleRole = useCallback(
    async (userId: string, current: string) => {
      setBusy(true);
      await updateUserRole(
        userId,
        current === "super_admin" ? "user" : "super_admin",
        mutate
      );
      setBusy(false);
    },
    [mutate]
  );

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-6">
        <Link href="/">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-3xl space-y-8">
          <BuildChatSettings />

          <InvitationCodesSection />

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="size-6" />
            </div>
          ) : (
            <div>
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                {t("usersList", { count: users.length })}
              </h2>
              <div className="flex flex-col gap-1">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50"
                  >
                    <Avatar className="size-8">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback>
                        {(user.nickname ?? user.email)?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {user.nickname || user.email}
                      </p>
                      {user.nickname && (
                        <p className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        user.platformRole === "super_admin" ? "default" : "secondary"
                      }
                    >
                      {user.platformRole === "super_admin" ? t("superAdmin") : t("userRole")}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      disabled={busy}
                      onClick={() => handleToggleRole(user.id, user.platformRole)}
                      title={
                        user.platformRole === "super_admin"
                          ? t("removeAdmin")
                          : t("setAdmin")
                      }
                    >
                      {user.platformRole === "super_admin" ? (
                        <ShieldOffIcon className="size-4" />
                      ) : (
                        <ShieldIcon className="size-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
