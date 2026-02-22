"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useClerk } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/lib/auth/hooks";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/auth/account-deletion-constants";

export function AccountRecoveryBanner() {
  const t = useTranslations("user");
  const { signOut } = useClerk();
  const { isPendingDeletion, deletedAt, mutate } = useCurrentUser();
  const [busy, setBusy] = useState(false);

  if (!isPendingDeletion || !deletedAt) return null;

  const deletionDate = new Date(deletedAt);
  deletionDate.setDate(deletionDate.getDate() + ACCOUNT_DELETION_GRACE_DAYS);
  const daysRemaining = Math.max(
    0,
    Math.ceil((deletionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  async function handleRecover() {
    setBusy(true);
    try {
      const res = await fetch("/api/user/recover", { method: "POST" });
      if (!res.ok) throw new Error();
      await mutate();
    } catch {
      toast.error(t("recoverFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 flex max-w-md flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center shadow-lg">
        <h2 className="text-lg font-semibold">{t("recoveryTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("recoveryDescription", {
            date: deletionDate.toLocaleDateString(),
            days: daysRemaining,
          })}
        </p>
        <div className="flex gap-3">
          <Button onClick={handleRecover} disabled={busy}>
            {busy ? <Spinner className="mr-1 size-4" /> : null}
            {busy ? t("recovering") : t("recoverButton")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            disabled={busy}
          >
            {t("continueSignOut")}
          </Button>
        </div>
      </div>
    </div>
  );
}
