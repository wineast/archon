"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useClerk } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/auth/account-deletion-constants";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const t = useTranslations("user");
  const { signOut } = useClerk();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [forceDeleting, setForceDeleting] = useState(false);

  const confirmWord = t("deleteAccountConfirmWord");
  const isConfirmed = confirmText === confirmWord;
  const isDev = process.env.NODE_ENV !== "production";

  function handleOpenChange(v: boolean) {
    if (busy || forceDeleting) return;
    if (!v) setConfirmText("");
    onOpenChange(v);
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch("/api/user", { method: "DELETE" });
      if (!res.ok) throw new Error();
      await signOut({ redirectUrl: "/sign-in" });
    } catch {
      toast.error(t("deleteAccountFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleForceDelete() {
    setForceDeleting(true);
    try {
      const res = await fetch("/api/user/force-delete", { method: "DELETE" });
      if (!res.ok) throw new Error();
      await signOut({ redirectUrl: "/sign-in" });
    } catch {
      toast.error(t("forceDeleteFailed"));
    } finally {
      setForceDeleting(false);
    }
  }

  const anyBusy = busy || forceDeleting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteAccountTitle")}</DialogTitle>
          <DialogDescription>
            {t("deleteAccountDescription", { days: ACCOUNT_DELETION_GRACE_DAYS })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("deleteAccountConfirmHint")}
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmWord}
            disabled={anyBusy}
            autoComplete="off"
          />
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={anyBusy}>
              {t("cancelButton")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!isConfirmed || anyBusy}
            >
              {busy ? <Spinner className="mr-1 size-4" /> : null}
              {busy ? t("deleteAccountDeleting") : t("deleteAccountButton")}
            </Button>
          </div>
          {isDev && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleForceDelete}
              disabled={anyBusy}
            >
              {forceDeleting ? <Spinner className="mr-1 size-4" /> : null}
              {forceDeleting ? t("forceDeleteDeleting") : t("forceDeleteAccount")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
